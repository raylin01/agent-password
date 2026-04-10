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
  agentpass list [--type <login|card|secret>] [--match <text>] [--tag <tag>] [--json]
  agentpass get-entry <entry-id-or-label> [--field-name <name>] [--output text|json|id|handle|handles]
  agentpass add-login --label <label> [--site <url>] [--notes <text>] [--tags <csv>] [--prompt] [--field-name <name>] [--output json|id|handle|handles]
  agentpass add-card --label <label> [--issuer <issuer>] [--notes <text>] [--tags <csv>] [--prompt] [--field-name <name>] [--output json|id|handle|handles]
  agentpass add-secret --label <label> [--provider <name>] [--field <name=value> ...] [--notes <text>] [--tags <csv>] [--prompt] [--field-name <name>] [--output json|id|handle|handles]
  agentpass edit-entry <entry-id-or-label> [--label <label>] [--site <url>] [--issuer <issuer>] [--provider <name>] [--notes <text>] [--tags <csv>]
  agentpass edit-field <field-id-or-handle> [--value <value>] [--prompt] [--disabled true|false] [--allow-mode <mode>] [--allow-origins <csv>]
  agentpass remove-entry <entry-id-or-key>
  agentpass remove-field <field-id-or-handle>
  agentpass totp <handle> [--code-only]
  agentpass render-file <template-path|-> [--output <path>] [--keep] [--cwd <dir>] [--timeout-ms <ms>] -- <command ...>
  agentpass browser-template <template-path> [--cwd <dir>] [--timeout-ms <ms>] -- [args ...]
  agentpass logs [--limit <n>] [--json]

Notes:
  - Run \`agentpass serve\` first.
  - Agents should use handles, not raw values, after creation.
  - Secret options can read from stdin by passing \`-\` as the value.
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
  const scope = entry.entryType === "login"
    ? entry.site
    : (entry.entryType === "card" ? entry.issuer : entry.provider);
  const scopeLabel = entry.entryType === "login"
    ? "site"
    : (entry.entryType === "card" ? "issuer" : "provider");
  const lines = [`${entry.label} (${entry.entryType})`];

  if (scope) {
    lines.push(`  ${scopeLabel}: ${scope}`);
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

function normalizeFieldName(value) {
  return String(value ?? "").trim().toLowerCase();
}

function resolveOutputMode(args, defaultMode = "json") {
  if (hasFlag(args, "--json")) {
    return "json";
  }

  return parseOptionValue(args, "--output") || defaultMode;
}

function selectEntryField(entry, fieldName) {
  if (fieldName) {
    const match = entry.fields.find((field) => normalizeFieldName(field.fieldName) === normalizeFieldName(fieldName));

    if (!match) {
      throw new Error(`Entry ${entry.label} does not have a ${fieldName} field.`);
    }

    return match;
  }

  if (entry.fields.length !== 1) {
    throw new Error(`Entry ${entry.label} has multiple fields. Use --field-name <name>.`);
  }

  return entry.fields[0];
}

function printEntryResult(entry, args, defaultMode = "json") {
  const outputMode = resolveOutputMode(args, defaultMode);

  if (outputMode === "json") {
    console.log(JSON.stringify(entry, null, 2));
    return;
  }

  if (outputMode === "text") {
    console.log(formatEntry(entry));
    return;
  }

  if (outputMode === "id") {
    console.log(entry.id);
    return;
  }

  if (outputMode === "handles") {
    for (const field of entry.fields) {
      console.log(`${field.fieldName}=${field.handle}`);
    }

    return;
  }

  if (outputMode === "handle") {
    console.log(selectEntryField(entry, parseOptionValue(args, "--field-name")).handle);
    return;
  }

  throw new Error(`Unsupported output mode: ${outputMode}`);
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

let stdinTextPromise = null;

async function readStdinText() {
  if (!stdinTextPromise) {
    stdinTextPromise = (async () => {
      if (process.stdin.isTTY) {
        throw new Error("Expected piped stdin input.");
      }

      let input = "";

      for await (const chunk of process.stdin) {
        input += chunk.toString();
      }

      return input;
    })();
  }

  return await stdinTextPromise;
}

async function readStdinValue() {
  const input = await readStdinText();
  return input.replace(/[\r\n]+$/u, "");
}

async function readOptionValue(args, optionName) {
  const directValue = parseOptionValue(args, optionName);

  if (directValue !== "-") {
    return directValue;
  }

  return await readStdinValue();
}

async function maybePromptValue(args, optionName, promptLabel, { secret = false, promptFlagName, promptAll = false } = {}) {
  const directValue = await readOptionValue(args, optionName);

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

async function parseSecretFieldArgs(args) {
  const fields = [];

  for (const value of parseRepeatedValues(args, "--field")) {
    const separatorIndex = value.indexOf("=");

    if (separatorIndex <= 0) {
      throw new Error(`Invalid --field value: ${value}. Use name=value.`);
    }

    const name = value.slice(0, separatorIndex).trim();
    const rawFieldValue = value.slice(separatorIndex + 1);
    const fieldValue = rawFieldValue === "-" ? await readStdinValue() : rawFieldValue;

    if (!name || !fieldValue.trim()) {
      throw new Error(`Invalid --field value: ${value}. Use name=value.`);
    }

    fields.push({
      name,
      value: fieldValue
    });
  }

  return fields;
}

async function promptSecretFields() {
  const fields = [];

  while (true) {
    const name = (await promptLine("Field name (blank to finish): ")).trim();

    if (!name) {
      break;
    }

    const value = await promptSecret(`Value for ${name}: `);

    if (!value.trim()) {
      throw new Error(`Field ${name} cannot be empty.`);
    }

    fields.push({
      name,
      value
    });
  }

  return fields;
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
    const params = new URLSearchParams();
    const typeFilter = parseOptionValue(argv, "--type");
    const matchFilter = parseOptionValue(argv, "--match");
    const tagFilter = parseOptionValue(argv, "--tag");

    if (typeFilter) {
      params.set("type", typeFilter);
    }

    if (matchFilter) {
      params.set("match", matchFilter);
    }

    if (tagFilter) {
      params.set("tag", tagFilter);
    }

    const entries = await api(`/api/entries${params.size ? `?${params}` : ""}`);

    if (resolveOutputMode(argv, "text") === "json") {
      console.log(JSON.stringify(entries, null, 2));
      return;
    }

    if (!entries.length && (typeFilter || matchFilter || tagFilter)) {
      console.log("No matching entries.");
      return;
    }

    printEntries(entries);
    return;
  }

  if (commandName === "get-entry") {
    const [identifier, ...rest] = argv;

    if (!identifier) {
      throw new Error("Usage: agentpass get-entry <entry-id-or-label> [...]");
    }

    const entry = await api(`/api/entries/${encodeURIComponent(identifier)}`);
    printEntryResult(entry, rest, "text");
    return;
  }

  if (commandName === "add-login") {
    const rest = argv;
    const label = parseOptionValue(rest, "--label");

    const promptAll = hasFlag(rest, "--prompt");
    const payload = {
      label,
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

    if (!payload.label) {
      throw new Error("Usage: agentpass add-login --label <label> [...]");
    }

    const result = await api("/api/entries/login", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    printEntryResult(result, rest);
    return;
  }

  if (commandName === "add-card") {
    const rest = argv;
    const label = parseOptionValue(rest, "--label");

    const promptAll = hasFlag(rest, "--prompt");
    const payload = {
      label,
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

    if (!payload.label) {
      throw new Error("Usage: agentpass add-card --label <label> [...]");
    }

    const result = await api("/api/entries/card", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    printEntryResult(result, rest);
    return;
  }

  if (commandName === "add-secret") {
    const promptAll = hasFlag(argv, "--prompt");
    const label = parseOptionValue(argv, "--label");
    const directFields = await parseSecretFieldArgs(argv);
    const promptedFields = promptAll ? await promptSecretFields() : [];
    const payload = {
      label,
      provider: parseOptionValue(argv, "--provider"),
      notes: parseOptionValue(argv, "--notes"),
      tags: parseOptionValue(argv, "--tags"),
      fields: [...directFields, ...promptedFields]
    };

    if (!payload.label) {
      throw new Error("Usage: agentpass add-secret --label <label> [--field <name=value> ...]");
    }

    if (!payload.fields.length) {
      throw new Error("Provide at least one --field <name=value> or use --prompt.");
    }

    const result = await api("/api/entries/secret", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    printEntryResult(result, argv);
    return;
  }

  if (commandName === "edit-entry") {
    const [identifier, ...rest] = argv;

    if (!identifier) {
      throw new Error("Usage: agentpass edit-entry <entry-id-or-label> [...]");
    }

    console.log(JSON.stringify(await api(`/api/entries/${encodeURIComponent(identifier)}`, {
      method: "PATCH",
      body: JSON.stringify({
        label: parseOptionValue(rest, "--label"),
        site: parseOptionValue(rest, "--site"),
        issuer: parseOptionValue(rest, "--issuer"),
        provider: parseOptionValue(rest, "--provider"),
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
    const value = (await readOptionValue(rest, "--value")) ?? (promptValue ? await promptSecret("New field value: ") : undefined);
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
      throw new Error("Usage: agentpass remove-entry <entry-id-or-label>");
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
    const [handle, ...rest] = argv;

    if (!handle) {
      throw new Error("Usage: agentpass totp <handle>");
    }

    const result = await api("/api/totp", {
      method: "POST",
      body: JSON.stringify({ handle })
    });

    if (hasFlag(rest, "--code-only")) {
      console.log(result.code);
      return;
    }

    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (commandName === "render-file") {
    const [templatePath, ...rest] = argv;

    if (!templatePath) {
      throw new Error("Usage: agentpass render-file <template-path|-> [options] -- <command ...>");
    }

    const { head, tail } = parseCommandTail(rest);
    const result = await api("/api/render-file", {
      method: "POST",
      body: JSON.stringify({
        templatePath: templatePath === "-" ? undefined : templatePath,
        templateContent: templatePath === "-" ? await readStdinText() : undefined,
        templateLabel: templatePath === "-" ? "<stdin>" : undefined,
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
