#!/usr/bin/env node
import path from "node:path";
import process from "node:process";

import { promptLine, promptSecret } from "./lib/prompt.mjs";
import { hasFlag, parseCommandTail, parseOptionValue } from "./lib/util.mjs";
import { startServer } from "./server.mjs";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 4765;
const DEFAULT_BASE_URL = `http://${DEFAULT_HOST}:${DEFAULT_PORT}`;
const DEFAULT_VAULT_PATH = path.resolve(process.cwd(), "data/agentpass.vault.json");

function help() {
  return `AgentPass

Commands:
  agentpass serve [--host 127.0.0.1] [--port 4765] [--vault ./data/agentpass.vault.json]
  agentpass status
  agentpass init
  agentpass unlock
  agentpass lock
  agentpass list [--json]
  agentpass put <entry-key> <field-name> [--label <label>] [--type <password|text|totp>] [--value <value>] [--prompt]
  agentpass run [--cwd <dir>] [--timeout-ms <ms>] [--env KEY=VALUE ...] -- <command ...>
  agentpass run-template <template-path> [--cwd <dir>] [--timeout-ms <ms>] [--env KEY=VALUE ...] -- <command ...>

Examples:
  agentpass put costco.com username --type text --prompt
  agentpass put costco.com password --type password --prompt
  agentpass run -- node script.mjs COSTCO_COM_USERNAME_1 COSTCO_COM_PASSWORD_1
  agentpass run-template ./examples/playwright.template.mjs -- node
`;
}

function baseUrl() {
  return process.env.AGENTPASS_BASE_URL || DEFAULT_BASE_URL;
}

async function api(pathname, options = {}) {
  const response = await fetch(`${baseUrl()}${pathname}`, {
    headers: {
      "content-type": "application/json"
    },
    ...options
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.error || `Request failed with status ${response.status}.`);
  }

  return body;
}

function extractEnvPairs(args) {
  const env = {};

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];

    if (current !== "--env") {
      continue;
    }

    const value = args[index + 1];

    if (!value || !value.includes("=")) {
      throw new Error("--env requires KEY=VALUE.");
    }

    const [key, ...rest] = value.split("=");
    env[key] = rest.join("=");
    index += 1;
  }

  return { env };
}

function printEntries(entries) {
  if (entries.length === 0) {
    console.log("No entries yet.");
    return;
  }

  for (const entry of entries) {
    console.log(`${entry.label} (${entry.key})`);

    for (const field of entry.fields) {
      console.log(`  - ${field.name} [${field.type}] ${field.handle} ${field.preview ? `(${field.preview})` : ""}`.trimEnd());
    }

    console.log("");
  }
}

async function getSecretValue({ prompt, value, fieldName, type }) {
  if (typeof value === "string") {
    return value;
  }

  if (prompt) {
    if (type === "password" || type === "totp") {
      return await promptSecret(`Value for ${fieldName}: `);
    }

    return await promptLine(`Value for ${fieldName}: `);
  }

  throw new Error("Provide --value or --prompt.");
}

async function run() {
  const [, , commandName, ...argv] = process.argv;

  if (!commandName || commandName === "--help" || commandName === "-h") {
    console.log(help());
    return;
  }

  if (commandName === "serve") {
    const host = parseOptionValue(argv, "--host") || DEFAULT_HOST;
    const port = Number(parseOptionValue(argv, "--port") || DEFAULT_PORT);
    const vaultPath = parseOptionValue(argv, "--vault") || DEFAULT_VAULT_PATH;
    const { host: listenHost, port: listenPort } = await startServer({
      host,
      port,
      vaultPath
    });
    console.log(`AgentPass server running at http://${listenHost}:${listenPort}`);
    console.log(`Vault file: ${path.resolve(vaultPath)}`);
    return;
  }

  if (commandName === "status") {
    console.log(JSON.stringify(await api("/api/status"), null, 2));
    return;
  }

  if (commandName === "init") {
    const passphrase = await promptSecret("New vault passphrase: ");
    const confirmation = await promptSecret("Confirm passphrase: ");

    if (passphrase !== confirmation) {
      throw new Error("Passphrases do not match.");
    }

    console.log(JSON.stringify(await api("/api/init", {
      method: "POST",
      body: JSON.stringify({ passphrase })
    }), null, 2));
    return;
  }

  if (commandName === "unlock") {
    const passphrase = await promptSecret("Vault passphrase: ");
    console.log(JSON.stringify(await api("/api/unlock", {
      method: "POST",
      body: JSON.stringify({ passphrase })
    }), null, 2));
    return;
  }

  if (commandName === "lock") {
    console.log(JSON.stringify(await api("/api/lock", {
      method: "POST"
    }), null, 2));
    return;
  }

  if (commandName === "list") {
    const entries = await api("/api/entries");

    if (hasFlag(argv, "--json")) {
      console.log(JSON.stringify(entries, null, 2));
      return;
    }

    printEntries(entries);
    return;
  }

  if (commandName === "put") {
    const [entryKey, fieldName, ...rest] = argv;

    if (!entryKey || !fieldName) {
      throw new Error("Usage: agentpass put <entry-key> <field-name> [...]");
    }

    const type = parseOptionValue(rest, "--type") || "text";
    const label = parseOptionValue(rest, "--label");
    const value = parseOptionValue(rest, "--value");
    const prompt = hasFlag(rest, "--prompt");
    const secretValue = await getSecretValue({
      prompt,
      value,
      fieldName,
      type
    });

    const entry = await api("/api/fields", {
      method: "POST",
      body: JSON.stringify({
        entryKey,
        label,
        name: fieldName,
        type,
        value: secretValue
      })
    });

    console.log(JSON.stringify(entry, null, 2));
    return;
  }

  if (commandName === "run") {
    const { head, tail } = parseCommandTail(argv);
    const cwd = parseOptionValue(head, "--cwd");
    const timeoutMs = Number(parseOptionValue(head, "--timeout-ms") || 120000);
    const { env } = extractEnvPairs(head);

    if (tail.length === 0) {
      throw new Error("Usage: agentpass run -- <command ...>");
    }

    const result = await api("/api/run", {
      method: "POST",
      body: JSON.stringify({
        command: tail,
        cwd,
        env,
        timeoutMs
      })
    });

    if (result.stdout) {
      process.stdout.write(result.stdout);
    }

    if (result.stderr) {
      process.stderr.write(result.stderr);
    }

    process.exit(result.exitCode ?? 0);
  }

  if (commandName === "run-template") {
    const [templatePath, ...rest] = argv;

    if (!templatePath) {
      throw new Error("Usage: agentpass run-template <template-path> -- <command ...>");
    }

    const { head, tail } = parseCommandTail(rest);
    const cwd = parseOptionValue(head, "--cwd");
    const timeoutMs = Number(parseOptionValue(head, "--timeout-ms") || 120000);
    const { env } = extractEnvPairs(head);

    if (tail.length === 0) {
      throw new Error("Usage: agentpass run-template <template-path> -- <command ...>");
    }

    const result = await api("/api/run-template", {
      method: "POST",
      body: JSON.stringify({
        templatePath: path.resolve(templatePath),
        command: tail,
        cwd,
        env,
        timeoutMs
      })
    });

    if (result.stdout) {
      process.stdout.write(result.stdout);
    }

    if (result.stderr) {
      process.stderr.write(result.stderr);
    }

    process.exit(result.exitCode ?? 0);
  }

  throw new Error(`Unknown command: ${commandName}`);
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
