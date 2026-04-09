#!/usr/bin/env node
import { spawn } from "node:child_process";
import process from "node:process";

import { promptLine, promptSecret } from "./lib/prompt.mjs";
import { parseOptionValue, parseCommandTail, hasFlag, normalizeStringList, coerceBoolean } from "./lib/util.mjs";
import { startServer } from "./server.mjs";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 4765;
const DEFAULT_BASE_URL = `http://${DEFAULT_HOST}:${DEFAULT_PORT}`;

function help() {
  return `AgentPass

Commands:
  agentpass serve [--host 127.0.0.1] [--port 4765] [--data-dir ~/.agentpass]
  agentpass status
  agentpass init
  agentpass unlock
  agentpass lock
  agentpass list [--json]
  agentpass add-login <key> [--label <label>] [--site <url>] [--notes <text>] [--tags <csv>] [--prompt]
  agentpass add-card <key> [--label <label>] [--issuer <issuer>] [--notes <text>] [--tags <csv>] [--prompt]
  agentpass edit-entry <entry-id-or-key> [--label <label>] [--site <url>] [--issuer <issuer>] [--notes <text>] [--tags <csv>]
  agentpass edit-field <field-id-or-handle> [--value <value>] [--prompt] [--disabled true|false] [--allow-mode <mode>] [--allow-origins <csv>]
  agentpass remove-entry <entry-id-or-key>
  agentpass remove-field <field-id-or-handle>
  agentpass totp <handle>
  agentpass render-file <template-path> [--output <path>] [--keep] [--cwd <dir>] [--timeout-ms <ms>] -- <command ...>
  agentpass browser-template <template-path> [--cwd <dir>] [--timeout-ms <ms>] -- [args ...]
  agentpass logs [--limit <n>] [--json]

Notes:
  - Run \`agentpass serve\` first.
  - Agents should use handles, not raw values, after creation.
`;
}

function baseUrl() {
  return process.env.AGENTPASS_BASE_URL || DEFAULT_BASE_URL;
}

function actorHeaders() {
  return {
    "x-agentpass-actor-type": process.env.AGENTPASS_ACTOR_TYPE || "agent",
    "x-agentpass-actor-id": process.env.AGENTPASS_ACTOR_ID || "agent-cli"
  };
}

async function api(pathname, options = {}) {
  const response = await fetch(`${baseUrl()}${pathname}`, {
    headers: {
      "content-type": "application/json",
      ...actorHeaders(),
      ...(options.headers || {})
    },
    ...options
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || `Request failed with status ${response.status}.`);
  }

  return payload;
}

function parseRepeatedValues(args, optionName) {
  const values = [];

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== optionName) {
      continue;
    }

    if (index === args.length - 1) {
      throw new Error(`Missing value for ${optionName}.`);
    }

    values.push(args[index + 1]);
    index += 1;
  }

  return values;
}

function formatEntry(entry) {
  const scope = entry.entryType === "login" ? entry.site : entry.issuer;
  const lines = [`${entry.label} (${entry.entryType})`, `  key: ${entry.key}`];

  if (scope) {
    lines.push(`  scope: ${scope}`);
  }

  if (entry.tags?.length) {
    lines.push(`  tags: ${entry.tags.join(", ")}`);
  }

  for (const field of entry.fields) {
    lines.push(`  - ${field.fieldName}: ${field.handle} (${field.previewMasked})`);
  }

  return lines.join("\n");
}

function printEntries(entries) {
  if (!entries.length) {
    console.log("No entries yet.");
    return;
  }

  for (const entry of entries) {
    console.log(formatEntry(entry));
    console.log("");
  }
}

function printLogs(events) {
  if (!events.length) {
    console.log("No logs yet.");
    return;
  }

  for (const event of events) {
    const detail = [event.timestamp, event.action, `${event.actor_type}:${event.actor_id}`, event.result]
      .filter(Boolean)
      .join(" | ");

    console.log(detail);

    if (event.handle) {
      console.log(`  handle: ${event.handle}`);
    }

    if (event.origin) {
      console.log(`  origin: ${event.origin}`);
    }

    if (event.file_path) {
      console.log(`  file: ${event.file_path}`);
    }

    if (event.message) {
      console.log(`  note: ${event.message}`);
    }

    console.log("");
  }
}

async function promptFieldValue(label, { secret = false } = {}) {
  return secret ? await promptSecret(`${label}: `) : await promptLine(`${label}: `);
}

async function maybePromptValue(args, optionName, promptLabel, { secret = false, promptFlagName, promptAll = false } = {}) {
  const directValue = parseOptionValue(args, optionName);

  if (directValue !== undefined) {
    return directValue;
  }

  if (promptAll || (promptFlagName && hasFlag(args, promptFlagName))) {
    return await promptFieldValue(promptLabel, {
      secret
    });
  }

  return undefined;
}

async function runTemplateProcess({ templatePath, args, cwd, timeoutMs = 120000 }) {
  return await new Promise((resolve, reject) => {
    let timedOut = false;
    const child = spawn("node", [templatePath, ...args], {
      cwd,
      env: {
        ...process.env,
        AGENTPASS_BASE_URL: baseUrl()
      },
      stdio: "inherit"
    });
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve(timedOut ? 124 : (code ?? 0));
    });
  });
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
    const dataDir = parseOptionValue(argv, "--data-dir") || process.env.AGENTPASS_DATA_DIR;
    const vaultPath = parseOptionValue(argv, "--vault");
    const logDir = parseOptionValue(argv, "--log-dir");
    const { host: listenHost, port: listenPort, service } = await startServer({
      host,
      port,
      dataDir,
      vaultPath,
      logDir
    });
    console.log(`AgentPass server running at http://${listenHost}:${listenPort}`);
    console.log(`Data directory: ${service.paths.dataDir}`);
    console.log(`Vault file: ${service.paths.vaultPath}`);
    console.log(`Log directory: ${service.paths.logDir}`);
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

  if (commandName === "add-login") {
    const [key, ...rest] = argv;

    if (!key) {
      throw new Error("Usage: agentpass add-login <key> [...]");
    }

    const promptAll = hasFlag(rest, "--prompt");
    const payload = {
      key,
      label: parseOptionValue(rest, "--label"),
      site: parseOptionValue(rest, "--site"),
      notes: parseOptionValue(rest, "--notes"),
      tags: parseOptionValue(rest, "--tags"),
      fieldValues: {
        username: await maybePromptValue(rest, "--username", "Username", {
          promptFlagName: "--prompt-username",
          promptAll
        }),
        email: await maybePromptValue(rest, "--email", "Email", {
          promptFlagName: "--prompt-email",
          promptAll
        }),
        password: await maybePromptValue(rest, "--password", "Password", {
          secret: true,
          promptFlagName: "--prompt-password",
          promptAll
        }),
        totp_seed: await maybePromptValue(rest, "--totp-seed", "TOTP seed", {
          secret: true,
          promptFlagName: "--prompt-totp",
          promptAll
        })
      }
    };

    console.log(JSON.stringify(await api("/api/entries/login", {
      method: "POST",
      body: JSON.stringify(payload)
    }), null, 2));
    return;
  }

  if (commandName === "add-card") {
    const [key, ...rest] = argv;

    if (!key) {
      throw new Error("Usage: agentpass add-card <key> [...]");
    }

    const promptAll = hasFlag(rest, "--prompt");
    const payload = {
      key,
      label: parseOptionValue(rest, "--label"),
      issuer: parseOptionValue(rest, "--issuer"),
      notes: parseOptionValue(rest, "--notes"),
      tags: parseOptionValue(rest, "--tags"),
      fieldValues: {
        cardholder_name: await maybePromptValue(rest, "--cardholder-name", "Cardholder name", {
          promptFlagName: "--prompt-name",
          promptAll
        }),
        card_number: await maybePromptValue(rest, "--card-number", "Card number", {
          secret: true,
          promptFlagName: "--prompt-number",
          promptAll
        }),
        expiry_month: await maybePromptValue(rest, "--expiry-month", "Expiry month", {
          promptFlagName: "--prompt-month",
          promptAll
        }),
        expiry_year: await maybePromptValue(rest, "--expiry-year", "Expiry year", {
          promptFlagName: "--prompt-year",
          promptAll
        }),
        cvv: await maybePromptValue(rest, "--cvv", "CVV", {
          secret: true,
          promptFlagName: "--prompt-cvv",
          promptAll
        }),
        billing_postal_code: await maybePromptValue(rest, "--billing-postal-code", "Billing ZIP or postal code", {
          promptFlagName: "--prompt-postal",
          promptAll
        })
      }
    };

    console.log(JSON.stringify(await api("/api/entries/card", {
      method: "POST",
      body: JSON.stringify(payload)
    }), null, 2));
    return;
  }

  if (commandName === "edit-entry") {
    const [identifier, ...rest] = argv;

    if (!identifier) {
      throw new Error("Usage: agentpass edit-entry <entry-id-or-key> [...]");
    }

    console.log(JSON.stringify(await api(`/api/entries/${encodeURIComponent(identifier)}`, {
      method: "PATCH",
      body: JSON.stringify({
        label: parseOptionValue(rest, "--label"),
        site: parseOptionValue(rest, "--site"),
        issuer: parseOptionValue(rest, "--issuer"),
        notes: parseOptionValue(rest, "--notes"),
        tags: parseOptionValue(rest, "--tags")
      })
    }), null, 2));
    return;
  }

  if (commandName === "edit-field") {
    const [identifier, ...rest] = argv;

    if (!identifier) {
      throw new Error("Usage: agentpass edit-field <field-id-or-handle> [...]");
    }

    const promptValue = hasFlag(rest, "--prompt");
    const value = parseOptionValue(rest, "--value") ?? (promptValue ? await promptSecret("New field value: ") : undefined);
    const disabledRaw = parseOptionValue(rest, "--disabled");
    const allowedModes = normalizeStringList([
      ...parseRepeatedValues(rest, "--allow-mode"),
      parseOptionValue(rest, "--allow-modes")
    ]);
    const allowedOrigins = parseOptionValue(rest, "--allow-origins");
    const body = {};

    if (value !== undefined) {
      body.value = value;
    }

    if (disabledRaw !== undefined || allowedModes.length > 0 || allowedOrigins !== undefined) {
      body.policy = {
        disabled: disabledRaw !== undefined ? coerceBoolean(disabledRaw) : false,
        allowedUseModes: allowedModes,
        allowedOrigins
      };
    }

    if (!("value" in body) && !("policy" in body)) {
      throw new Error("Provide --value, --prompt, or policy options to edit a field.");
    }

    console.log(JSON.stringify(await api(`/api/fields/${encodeURIComponent(identifier)}`, {
      method: "PATCH",
      body: JSON.stringify(body)
    }), null, 2));
    return;
  }

  if (commandName === "remove-entry") {
    const [identifier] = argv;

    if (!identifier) {
      throw new Error("Usage: agentpass remove-entry <entry-id-or-key>");
    }

    console.log(JSON.stringify(await api(`/api/entries/${encodeURIComponent(identifier)}`, {
      method: "DELETE"
    }), null, 2));
    return;
  }

  if (commandName === "remove-field") {
    const [identifier] = argv;

    if (!identifier) {
      throw new Error("Usage: agentpass remove-field <field-id-or-handle>");
    }

    console.log(JSON.stringify(await api(`/api/fields/${encodeURIComponent(identifier)}`, {
      method: "DELETE"
    }), null, 2));
    return;
  }

  if (commandName === "totp") {
    const [handle] = argv;

    if (!handle) {
      throw new Error("Usage: agentpass totp <handle>");
    }

    console.log(JSON.stringify(await api("/api/totp", {
      method: "POST",
      body: JSON.stringify({ handle })
    }), null, 2));
    return;
  }

  if (commandName === "render-file") {
    const [templatePath, ...rest] = argv;

    if (!templatePath) {
      throw new Error("Usage: agentpass render-file <template-path> [options] -- <command ...>");
    }

    const { head, tail } = parseCommandTail(rest);
    const result = await api("/api/render-file", {
      method: "POST",
      body: JSON.stringify({
        templatePath,
        outputPath: parseOptionValue(head, "--output"),
        keep: hasFlag(head, "--keep"),
        cwd: parseOptionValue(head, "--cwd"),
        timeoutMs: Number(parseOptionValue(head, "--timeout-ms") || 120000),
        command: tail.length ? tail : undefined
      })
    });

    if (result.execution?.stdout) {
      process.stdout.write(result.execution.stdout);
    }

    if (result.execution?.stderr) {
      process.stderr.write(result.execution.stderr);
    }

    if (!result.execution) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    process.exit(result.execution.exitCode ?? 0);
  }

  if (commandName === "browser-template") {
    const [templatePath, ...rest] = argv;

    if (!templatePath) {
      throw new Error("Usage: agentpass browser-template <template-path> -- [args ...]");
    }

    const { head, tail } = parseCommandTail(rest);
    const exitCode = await runTemplateProcess({
      templatePath,
      args: tail,
      cwd: parseOptionValue(head, "--cwd"),
      timeoutMs: Number(parseOptionValue(head, "--timeout-ms") || 120000)
    });
    process.exit(exitCode);
  }

  if (commandName === "logs") {
    const limit = Number(parseOptionValue(argv, "--limit") || 50);
    const events = await api(`/api/logs?limit=${limit}`);

    if (hasFlag(argv, "--json")) {
      console.log(JSON.stringify(events, null, 2));
      return;
    }

    printLogs(events);
    return;
  }

  throw new Error(`Unknown command: ${commandName}`);
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
