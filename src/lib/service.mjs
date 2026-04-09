import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

import { buildHandleMap, redactSecrets, replaceHandles, replaceHandlesInArray, replaceHandlesInEnv } from "./substitution.mjs";
import { createEmptyVault, readVault, vaultExists, writeVault } from "./vault-file.mjs";
import { createHandle, maskValue, normalizeEntryKey, nowIso, randomId, trimToUndefined } from "./util.mjs";

function makeLockedError() {
  const error = new Error("Vault is locked.");
  error.code = "VAULT_LOCKED";
  return error;
}

function sanitizeField(field) {
  return {
    id: field.id,
    name: field.name,
    type: field.type,
    handle: field.handle,
    updatedAt: field.updatedAt,
    preview: maskValue(field.value)
  };
}

function sanitizeEntry(entry) {
  return {
    id: entry.id,
    key: entry.key,
    label: entry.label,
    notes: entry.notes,
    updatedAt: entry.updatedAt,
    fields: entry.fields.map(sanitizeField)
  };
}

export class AgentPassService {
  constructor({ vaultPath }) {
    this.vaultPath = vaultPath;
    this.vault = null;
    this.passphrase = null;
  }

  async status() {
    const initialized = await vaultExists(this.vaultPath);

    return {
      vaultPath: this.vaultPath,
      initialized,
      locked: this.vault === null,
      entryCount: this.vault?.entries.length ?? 0
    };
  }

  ensureUnlocked() {
    if (!this.vault || !this.passphrase) {
      throw makeLockedError();
    }
  }

  async init(passphrase) {
    if (await vaultExists(this.vaultPath)) {
      throw new Error(`Vault already exists at ${this.vaultPath}.`);
    }

    this.vault = createEmptyVault();
    this.passphrase = passphrase;
    await this.save();
    return this.status();
  }

  async unlock(passphrase) {
    if (!(await vaultExists(this.vaultPath))) {
      throw new Error(`Vault does not exist yet at ${this.vaultPath}. Run init first.`);
    }

    this.vault = await readVault(this.vaultPath, passphrase);
    this.passphrase = passphrase;
    return this.status();
  }

  lock() {
    this.vault = null;
    this.passphrase = null;
    return {
      locked: true
    };
  }

  async save() {
    this.ensureUnlocked();
    this.vault.updatedAt = nowIso();
    await writeVault(this.vaultPath, this.vault, this.passphrase);
  }

  listEntries() {
    this.ensureUnlocked();
    return this.vault.entries.map(sanitizeEntry);
  }

  findEntryByKey(entryKey) {
    this.ensureUnlocked();
    const normalizedKey = normalizeEntryKey(entryKey);
    return this.vault.entries.find((entry) => entry.key === normalizedKey);
  }

  async putField({ entryKey, label, notes, name, type = "text", value }) {
    this.ensureUnlocked();

    const normalizedEntryKey = normalizeEntryKey(entryKey);
    const trimmedFieldName = trimToUndefined(name);

    if (!trimmedFieldName) {
      throw new Error("Field name cannot be empty.");
    }

    if (typeof value !== "string" || value.length === 0) {
      throw new Error("Secret value cannot be empty.");
    }

    let entry = this.findEntryByKey(normalizedEntryKey);

    if (!entry) {
      entry = {
        id: randomId("entry_"),
        key: normalizedEntryKey,
        label: trimToUndefined(label) || normalizedEntryKey,
        notes: trimToUndefined(notes) || "",
        createdAt: nowIso(),
        updatedAt: nowIso(),
        fields: []
      };
      this.vault.entries.push(entry);
    } else if (trimToUndefined(label)) {
      entry.label = trimToUndefined(label);
    }

    const existingField = entry.fields.find((field) => field.name === trimmedFieldName);

    if (existingField) {
      existingField.type = type;
      existingField.value = value;
      existingField.updatedAt = nowIso();
    } else {
      const sameNameCount = entry.fields.filter((field) => field.name === trimmedFieldName).length;

      entry.fields.push({
        id: randomId("field_"),
        name: trimmedFieldName,
        type,
        value,
        handle: createHandle(entry.key, trimmedFieldName, sameNameCount + 1),
        createdAt: nowIso(),
        updatedAt: nowIso()
      });
    }

    entry.updatedAt = nowIso();
    await this.save();

    return sanitizeEntry(entry);
  }

  resolveHandle(handle) {
    this.ensureUnlocked();

    for (const entry of this.vault.entries) {
      for (const field of entry.fields) {
        if (field.handle === handle) {
          return field.value;
        }
      }
    }

    return null;
  }

  getHandleMap() {
    this.ensureUnlocked();
    return buildHandleMap(this.vault);
  }

  async runCommand({ command, cwd, env, stdin, timeoutMs = 120000 }) {
    this.ensureUnlocked();

    if (!Array.isArray(command) || command.length === 0) {
      throw new Error("A command array is required.");
    }

    const handleMap = this.getHandleMap();
    const substitutedCommand = replaceHandlesInArray(command, handleMap);
    const substitutedEnv = replaceHandlesInEnv(env || {}, handleMap);
    const substitutedStdin = typeof stdin === "string" ? replaceHandles(stdin, handleMap) : undefined;

    return await new Promise((resolve, reject) => {
      let stdout = "";
      let stderr = "";
      let timedOut = false;
      const child = spawn(substitutedCommand[0], substitutedCommand.slice(1), {
        cwd,
        env: {
          ...process.env,
          ...substitutedEnv
        },
        stdio: "pipe"
      });

      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, timeoutMs);

      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      child.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      child.on("close", (exitCode, signal) => {
        clearTimeout(timeout);

        resolve({
          exitCode: exitCode ?? (timedOut ? 124 : 1),
          signal,
          timedOut,
          stdout: redactSecrets(stdout, handleMap),
          stderr: redactSecrets(stderr, handleMap)
        });
      });

      if (typeof substitutedStdin === "string") {
        child.stdin.write(substitutedStdin);
      }

      child.stdin.end();
    });
  }

  async runTemplate({ templatePath, command, cwd, env, timeoutMs }) {
    this.ensureUnlocked();

    if (!templatePath) {
      throw new Error("A template path is required.");
    }

    const template = await fs.readFile(templatePath, "utf8");
    const rendered = replaceHandles(template, this.getHandleMap());
    const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "agentpass-"));
    const baseName = path
      .basename(templatePath)
      .replace(/\.template(?=\.)/u, "")
      .replace(/\.template$/u, "");
    const tempPath = path.join(tempDirectory, baseName);

    try {
      await fs.writeFile(tempPath, rendered, {
        encoding: "utf8",
        mode: 0o600
      });
      await fs.chmod(tempPath, 0o600);

      return await this.runCommand({
        command: [...command, tempPath],
        cwd,
        env,
        timeoutMs
      });
    } finally {
      await fs.rm(tempDirectory, {
        recursive: true,
        force: true
      });
    }
  }
}

export function isLockedError(error) {
  return error?.code === "VAULT_LOCKED";
}
