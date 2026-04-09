import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import { AuditLog } from "./audit-log.mjs";
import { ensureDataPaths, resolveDataPaths } from "./paths.mjs";
import { checkFieldPolicy, normalizePolicy } from "./policy.mjs";
import { buildHandleMap, redactSecrets, replaceHandles } from "./substitution.mjs";
import { writeRenderedTempFile } from "./temp-files.mjs";
import { generateTotp } from "./totp.mjs";
import { normalizeEntryKey, nowIso, normalizeStringList, trimToUndefined } from "./util.mjs";
import { readVault, vaultExists, writeVault } from "./vault-file.mjs";
import { createEmptyVault, createSensitiveField, createEntry, fieldNamesForEntryType, getFieldDefinition, isFreeformEntryType, sanitizeEntry } from "./vault-schema.mjs";

function makeLockedError() {
  const error = new Error("Vault is locked.");
  error.code = "VAULT_LOCKED";
  return error;
}

function defaultActor(actor) {
  return {
    actor_type: actor?.actor_type || actor?.type || "system",
    actor_id: actor?.actor_id || actor?.id || "agentpass"
  };
}

function redactTemplateContent(content, replacementMap) {
  return redactSecrets(content, replacementMap);
}

function actionForUseMode(useMode) {
  if (useMode === "browser_fill") {
    return "secret.browser_fill";
  }

  if (useMode === "file_render") {
    return "secret.file_render";
  }

  if (useMode === "totp_generate") {
    return "secret.totp_generate";
  }

  return "secret.use";
}

function normalizeLabelForCompare(label) {
  return String(label ?? "").trim().toLowerCase();
}

function normalizeFieldNameForCompare(fieldName) {
  return String(fieldName ?? "").trim().toLowerCase();
}

async function executeChildProcess({ command, cwd, env, timeoutMs = 120000, redactionMap = new Map() }) {
  if (!Array.isArray(command) || command.length === 0) {
    throw new Error("A command array is required.");
  }

  return await new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const child = spawn(command[0], command.slice(1), {
      cwd,
      env: {
        ...process.env,
        ...env
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
        stdout: redactSecrets(stdout, redactionMap),
        stderr: redactSecrets(stderr, redactionMap)
      });
    });
  });
}

export class AgentPassService {
  constructor(options = {}) {
    this.paths = resolveDataPaths(options);
    this.auditLog = new AuditLog(this.paths);
    this.vault = null;
    this.passphrase = null;
    this.saveQueue = Promise.resolve();
  }

  async status() {
    const initialized = await vaultExists(this.paths.vaultPath);

    return {
      dataDir: this.paths.dataDir,
      vaultPath: this.paths.vaultPath,
      logDir: this.paths.logDir,
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

  async init(passphrase, actor) {
    if (!passphrase) {
      throw new Error("A passphrase is required.");
    }

    if (await vaultExists(this.paths.vaultPath)) {
      throw new Error(`Vault already exists at ${this.paths.vaultPath}.`);
    }

    await ensureDataPaths(this.paths);
    this.vault = createEmptyVault();
    this.passphrase = passphrase;
    await this.save();
    await this.auditLog.append({
      ...defaultActor(actor),
      action: "vault.init",
      target_type: "vault",
      target_id: this.paths.vaultPath
    });

    return await this.status();
  }

  async unlock(passphrase, actor) {
    if (!passphrase) {
      throw new Error("A passphrase is required.");
    }

    if (!(await vaultExists(this.paths.vaultPath))) {
      throw new Error(`Vault does not exist yet at ${this.paths.vaultPath}. Run init first.`);
    }

    this.vault = await readVault(this.paths.vaultPath, passphrase);
    this.passphrase = passphrase;
    await this.auditLog.append({
      ...defaultActor(actor),
      action: "vault.unlock",
      target_type: "vault",
      target_id: this.paths.vaultPath
    });

    return await this.status();
  }

  async lock(actor) {
    this.vault = null;
    this.passphrase = null;
    await this.auditLog.append({
      ...defaultActor(actor),
      action: "vault.lock",
      target_type: "vault",
      target_id: this.paths.vaultPath
    });

    return {
      locked: true
    };
  }

  async save() {
    this.ensureUnlocked();
    const pendingSave = this.saveQueue.then(async () => {
      this.vault.updatedAt = nowIso();
      await ensureDataPaths(this.paths);
      await writeVault(this.paths.vaultPath, this.vault, this.passphrase);
    });
    this.saveQueue = pendingSave.catch(() => {});
    await pendingSave;
  }

  listEntries() {
    this.ensureUnlocked();
    return this.vault.entries.map((entry) => sanitizeEntry(entry));
  }

  async listLogs(limit = 200) {
    return await this.auditLog.list({
      limit
    });
  }

  findEntry(identifier) {
    this.ensureUnlocked();
    let normalizedKey = null;

    if (identifier) {
      try {
        normalizedKey = normalizeEntryKey(identifier);
      } catch {
        normalizedKey = null;
      }
    }

    const normalizedLabel = identifier ? normalizeLabelForCompare(identifier) : null;

    return this.vault.entries.find((entry) => (
      entry.id === identifier ||
      entry.key === identifier ||
      entry.key === normalizedKey ||
      normalizeLabelForCompare(entry.label) === normalizedLabel
    )) || null;
  }

  findField(identifier) {
    this.ensureUnlocked();

    for (const entry of this.vault.entries) {
      for (const field of entry.fields) {
        if (field.id === identifier || field.handle === identifier) {
          return {
            entry,
            field
          };
        }
      }
    }

    return null;
  }

  deriveEntryKeyFromLabel(label) {
    return normalizeEntryKey(label);
  }

  dedupeLabel(requestedLabel, excludingEntryId) {
    this.ensureUnlocked();
    const baseLabel = trimToUndefined(requestedLabel);

    if (!baseLabel) {
      throw new Error("A label is required.");
    }

    const dedupeBase = baseLabel.replace(/\s+\(\d+\)$/u, "").trim() || baseLabel;
    const normalizedExistingLabels = new Set();
    const existingKeys = new Set();

    for (const entry of this.vault.entries) {
      if (excludingEntryId && entry.id === excludingEntryId) {
        continue;
      }

      normalizedExistingLabels.add(normalizeLabelForCompare(entry.label));
      existingKeys.add(entry.key);
    }

    let suffix = 0;

    while (suffix < 10000) {
      const candidateLabel = suffix === 0 ? dedupeBase : `${dedupeBase} (${suffix})`;
      const candidateKey = this.deriveEntryKeyFromLabel(candidateLabel);

      if (!normalizedExistingLabels.has(normalizeLabelForCompare(candidateLabel)) && !existingKeys.has(candidateKey)) {
        return candidateLabel;
      }

      suffix += 1;
    }

    throw new Error(`Unable to derive a unique label for ${baseLabel}.`);
  }

  findFieldByName(entry, fieldName) {
    const normalizedFieldName = normalizeFieldNameForCompare(fieldName);
    return entry.fields.find((field) => normalizeFieldNameForCompare(field.fieldName) === normalizedFieldName) || null;
  }

  regenerateEntryHandles(entry) {
    const counts = new Map();

    for (const field of entry.fields) {
      const normalizedFieldName = String(field.fieldName ?? "").trim();
      const nextIndex = (counts.get(normalizedFieldName) || 0) + 1;
      counts.set(normalizedFieldName, nextIndex);
      field.handle = createSensitiveField({
        entryType: entry.entryType,
        entryId: entry.id,
        entryKey: entry.key,
        fieldName: normalizedFieldName,
        value: field.value,
        policy: field.policy,
        createdAt: field.createdAt,
        updatedAt: field.updatedAt,
        lastUsedAt: field.lastUsedAt
      }).handle;
      field.previewMasked = createSensitiveField({
        entryType: entry.entryType,
        entryId: entry.id,
        entryKey: entry.key,
        fieldName: normalizedFieldName,
        value: field.value,
        handle: field.handle,
        policy: field.policy,
        createdAt: field.createdAt,
        updatedAt: field.updatedAt,
        lastUsedAt: field.lastUsedAt
      }).previewMasked;

      if (nextIndex > 1) {
        field.handle = field.handle.replace(/_1$/u, `_${nextIndex}`);
      }
    }
  }

  async createTypedEntry(entryType, payload, actor) {
    this.ensureUnlocked();

    const label = this.dedupeLabel(payload.label);
    const key = this.deriveEntryKeyFromLabel(label);
    const fieldNames = fieldNamesForEntryType(entryType);
    const hasAtLeastOneValue = fieldNames.some((fieldName) => trimToUndefined(payload.fieldValues?.[fieldName]));

    if (!hasAtLeastOneValue) {
      throw new Error(`At least one ${entryType} field value is required.`);
    }

    const entry = createEntry({
      entryType,
      key,
      label,
      site: payload.site,
      issuer: payload.issuer,
      notes: payload.notes,
      tags: payload.tags,
      fieldValues: payload.fieldValues
    });

    this.vault.entries.push(entry);
    await this.save();
    await this.auditLog.append({
      ...defaultActor(actor),
      action: entryType === "login" ? "entry.login.add" : "entry.card.add",
      target_type: "entry",
      target_id: entry.id
    });

    return sanitizeEntry(entry);
  }

  async createLoginEntry(payload, actor) {
    return await this.createTypedEntry("login", payload, actor);
  }

  async createCardEntry(payload, actor) {
    return await this.createTypedEntry("card", payload, actor);
  }

  async createSecretEntry(payload, actor) {
    this.ensureUnlocked();
    const label = this.dedupeLabel(payload.label);
    const key = this.deriveEntryKeyFromLabel(label);
    const fields = (payload.fields || [])
      .map((field) => ({
        name: trimToUndefined(field?.name),
        value: trimToUndefined(field?.value),
        policy: field?.policy
      }))
      .filter((field) => field.name || field.value);

    if (!fields.length) {
      throw new Error("At least one secret field is required.");
    }

    const seenFieldNames = new Set();

    for (const field of fields) {
      if (!field.name || !field.value) {
        throw new Error("Each secret field requires both a name and a value.");
      }

      const normalizedFieldName = normalizeFieldNameForCompare(field.name);

      if (seenFieldNames.has(normalizedFieldName)) {
        throw new Error(`Duplicate secret field name: ${field.name}`);
      }

      seenFieldNames.add(normalizedFieldName);
    }

    const entry = createEntry({
      entryType: "secret",
      key,
      label,
      provider: payload.provider,
      notes: payload.notes,
      tags: payload.tags,
      fields
    });

    this.vault.entries.push(entry);
    await this.save();
    await this.auditLog.append({
      ...defaultActor(actor),
      action: "entry.secret.add",
      target_type: "entry",
      target_id: entry.id
    });

    return sanitizeEntry(entry);
  }

  async updateEntry(identifier, updates, actor) {
    this.ensureUnlocked();
    const entry = this.findEntry(identifier);

    if (!entry) {
      throw new Error(`Entry ${identifier} was not found.`);
    }

    const nextLabelInput = trimToUndefined(updates.label);
    const nextLabel = nextLabelInput ? this.dedupeLabel(nextLabelInput, entry.id) : entry.label;
    const renamed = nextLabel !== entry.label;

    if (nextLabelInput) {
      entry.label = nextLabel;
    }

    if (renamed) {
      entry.key = this.deriveEntryKeyFromLabel(nextLabel);
      this.regenerateEntryHandles(entry);
    }

    if (updates.site !== undefined) {
      entry.site = trimToUndefined(updates.site) || "";
    }

    if (updates.issuer !== undefined) {
      entry.issuer = trimToUndefined(updates.issuer) || "";
    }

    if (updates.provider !== undefined) {
      entry.provider = trimToUndefined(updates.provider) || "";
    }

    if (updates.notes !== undefined) {
      entry.notes = trimToUndefined(updates.notes) || "";
    }

    if (updates.tags !== undefined) {
      entry.tags = normalizeStringList(updates.tags);
    }

    entry.updatedAt = nowIso();
    await this.save();
    await this.auditLog.append({
      ...defaultActor(actor),
      action: renamed ? "entry.rename" : "entry.update",
      target_type: "entry",
      target_id: entry.id
    });

    return sanitizeEntry(entry);
  }

  async updateField(identifier, updates, actor) {
    this.ensureUnlocked();
    const match = this.findField(identifier);

    if (!match) {
      throw new Error(`Field ${identifier} was not found.`);
    }

    const { entry, field } = match;

    if (updates.value !== undefined) {
      const nextValue = trimToUndefined(updates.value);

      if (!nextValue) {
        throw new Error("Field value cannot be empty.");
      }

      field.value = nextValue;
      field.previewMasked = createSensitiveField({
        entryType: entry.entryType,
        entryId: entry.id,
        entryKey: entry.key,
        fieldName: field.fieldName,
        value: nextValue,
        handle: field.handle,
        policy: field.policy,
        createdAt: field.createdAt,
        updatedAt: field.updatedAt,
        lastUsedAt: field.lastUsedAt
      }).previewMasked;
    }

    if (updates.policy !== undefined) {
      field.policy = normalizePolicy(updates.policy, {
        defaultUseModes: getFieldDefinition(entry.entryType, field.fieldName).defaultUseModes
      });
    }

    field.updatedAt = nowIso();
    entry.updatedAt = nowIso();
    await this.save();
    await this.auditLog.append({
      ...defaultActor(actor),
      action: "field.update",
      target_type: "field",
      target_id: field.id,
      handle: field.handle
    });

    return sanitizeEntry(entry);
  }

  async removeEntry(identifier, actor) {
    this.ensureUnlocked();
    const entry = this.findEntry(identifier);

    if (!entry) {
      throw new Error(`Entry ${identifier} was not found.`);
    }

    this.vault.entries = this.vault.entries.filter((currentEntry) => currentEntry.id !== entry.id);
    await this.save();
    await this.auditLog.append({
      ...defaultActor(actor),
      action: "entry.remove",
      target_type: "entry",
      target_id: entry.id
    });

    return {
      removed: true,
      entryId: entry.id
    };
  }

  async removeField(identifier, actor) {
    this.ensureUnlocked();
    const match = this.findField(identifier);

    if (!match) {
      throw new Error(`Field ${identifier} was not found.`);
    }

    const { entry, field } = match;
    entry.fields = entry.fields.filter((currentField) => currentField.id !== field.id);
    entry.updatedAt = nowIso();
    await this.save();
    await this.auditLog.append({
      ...defaultActor(actor),
      action: "field.remove",
      target_type: "field",
      target_id: field.id,
      handle: field.handle
    });

    return sanitizeEntry(entry);
  }

  async addField(identifier, fieldName, value, actor, policy) {
    this.ensureUnlocked();
    const entry = this.findEntry(identifier);

    if (!entry) {
      throw new Error(`Entry ${identifier} was not found.`);
    }

    const nextValue = trimToUndefined(value);

    if (!nextValue) {
      throw new Error("Field value cannot be empty.");
    }

    const normalizedFieldName = trimToUndefined(fieldName);

    if (!normalizedFieldName) {
      throw new Error("Field name is required.");
    }

    if (!isFreeformEntryType(entry.entryType)) {
      getFieldDefinition(entry.entryType, normalizedFieldName);
    }

    const existingField = this.findFieldByName(entry, normalizedFieldName);

    if (existingField) {
      return await this.updateField(existingField.id, {
        value: nextValue,
        policy
      }, actor);
    }

    const createdField = createSensitiveField({
      entryType: entry.entryType,
      entryId: entry.id,
      entryKey: entry.key,
      fieldName: normalizedFieldName,
      value: nextValue,
      policy
    });

    entry.fields.push(createdField);
    entry.updatedAt = nowIso();
    await this.save();
    await this.auditLog.append({
      ...defaultActor(actor),
      action: "field.add",
      target_type: "field",
      target_id: createdField.id,
      handle: createdField.handle
    });

    return sanitizeEntry(entry);
  }

  buildHandleMap() {
    this.ensureUnlocked();
    return buildHandleMap(this.vault);
  }

  async resolveValueForUse({ handle, useMode, origin, actor, filePath }) {
    this.ensureUnlocked();
    const actorContext = defaultActor(actor);
    const match = this.findField(handle);

    if (!match) {
      await this.auditLog.append({
        ...actorContext,
        action: "secret.lookup.failed",
        target_type: "field",
        handle,
        origin,
        file_path: filePath,
        result: "failure",
        message: "Handle not found."
      });
      throw new Error(`Handle ${handle} was not found.`);
    }

    const { entry, field } = match;
    const policyResult = checkFieldPolicy(field, {
      useMode,
      origin
    });

    if (!policyResult.allowed) {
      await this.auditLog.append({
        ...actorContext,
        action: "policy.denied",
        target_type: "field",
        target_id: field.id,
        handle: field.handle,
        origin,
        file_path: filePath,
        result: "failure",
        message: policyResult.reason
      });
      throw new Error(policyResult.reason);
    }

    let resolvedValue = field.value;

    if (field.fieldName === "totp_seed") {
      resolvedValue = generateTotp(field.value).code;
    } else if (useMode === "totp_generate") {
      await this.auditLog.append({
        ...actorContext,
        action: "policy.denied",
        target_type: "field",
        target_id: field.id,
        handle: field.handle,
        result: "failure",
        message: "Only TOTP fields can be used for TOTP generation."
      });
      throw new Error("Only TOTP fields can be used for TOTP generation.");
    }

    field.lastUsedAt = nowIso();
    field.updatedAt = field.updatedAt || nowIso();
    entry.updatedAt = nowIso();
    await this.save();
    await this.auditLog.append({
      ...actorContext,
      action: actionForUseMode(useMode),
      target_type: "field",
      target_id: field.id,
      handle: field.handle,
      origin: policyResult.normalizedOrigin || origin,
      file_path: filePath,
      result: "success"
    });

    return {
      entry,
      field,
      value: resolvedValue
    };
  }

  async generateTotpCode(handle, actor) {
    const result = await this.resolveValueForUse({
      handle,
      useMode: "totp_generate",
      actor
    });
    const generated = generateTotp(result.field.value);

    return {
      handle,
      code: generated.code,
      expiresAt: generated.expiresAt
    };
  }

  async prepareBrowserFill(handle, origin, actor) {
    const result = await this.resolveValueForUse({
      handle,
      useMode: "browser_fill",
      origin,
      actor
    });

    return {
      handle,
      fieldName: result.field.fieldName,
      value: result.value,
      origin
    };
  }

  async renderFile({ templatePath, outputPath, command, cwd, timeoutMs = 120000, keep = false, actor }) {
    this.ensureUnlocked();
    const actorContext = defaultActor(actor);
    const template = await fs.readFile(templatePath, "utf8");
    const knownHandles = [...this.buildHandleMap().keys()].filter((handle) => template.includes(handle));
    const replacementMap = new Map();

    for (const handle of knownHandles) {
      const result = await this.resolveValueForUse({
        handle,
        useMode: "file_render",
        actor: actorContext,
        filePath: outputPath || templatePath
      });
      replacementMap.set(handle, result.value);
    }

    const rendered = replaceHandles(template, replacementMap);
    const shouldKeepTempFile = Boolean(keep || outputPath || !command?.length);
    let renderedFilePath = outputPath ? path.resolve(outputPath) : null;
    let cleanup = async () => {};

    if (outputPath) {
      await fs.mkdir(path.dirname(renderedFilePath), {
        recursive: true
      });
      await fs.writeFile(renderedFilePath, rendered, {
        encoding: "utf8",
        mode: 0o600
      });
      await fs.chmod(renderedFilePath, 0o600);
    } else {
      const tempFile = await writeRenderedTempFile({
        sourcePath: templatePath,
        content: rendered
      });
      renderedFilePath = tempFile.filePath;
      cleanup = tempFile.cleanup;
    }

    let execution = null;

    if (command?.length) {
      const finalCommand = command.some((part) => part === "AGENTPASS_RENDERED_FILE")
        ? command.map((part) => (part === "AGENTPASS_RENDERED_FILE" ? renderedFilePath : part))
        : [...command, renderedFilePath];

      execution = await executeChildProcess({
        command: finalCommand,
        cwd,
        env: {
          AGENTPASS_RENDERED_FILE: renderedFilePath
        },
        timeoutMs,
        redactionMap: replacementMap
      });
    }

    await this.auditLog.append({
      ...actorContext,
      action: "file.render.complete",
      target_type: "file",
      target_id: templatePath,
      file_path: renderedFilePath,
      result: execution?.exitCode && execution.exitCode !== 0 ? "failure" : "success",
      message: redactTemplateContent(`rendered ${knownHandles.length} handles`, replacementMap)
    });

    if (!shouldKeepTempFile && !outputPath) {
      await cleanup();
    }

    return {
      templatePath: path.resolve(templatePath),
      renderedFilePath,
      kept: shouldKeepTempFile,
      execution
    };
  }
}

export function isLockedError(error) {
  return error?.code === "VAULT_LOCKED";
}
