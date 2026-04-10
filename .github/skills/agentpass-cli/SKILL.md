---
name: agentpass-cli
description: Use the local AgentPass CLI to manage entries, discover handles, render files, generate TOTP codes, and drive browser login flows without relying on raw vault access.
---

# AgentPass CLI

Use this skill when a task mentions AgentPass, vaults, handles, TOTP, password filling, login automation, browser-template, render-file, or secret substitution.

This repository already provides a complete local CLI. Do not invent a separate secret interface when the AgentPass CLI covers the workflow.

## Mental Model

- Humans control vault initialization and unlock state.
- Agents operate through the CLI and browser helper flows.
- Prefer handles over raw secret values in reasoning, logs, and chat.
- If the vault is locked, stop and ask the human to unlock it.
- Do not read or modify the encrypted vault file directly.
- Prefer narrow actions like `get-entry`, filtered `list`, `totp --code-only`, `render-file`, and `browser-template` over ad hoc secret handling.

## Command Form

Inside this repo, prefer:

```bash
node ./src/cli.mjs <command>
```

If the package has been installed as a binary, `agentpass <command>` is equivalent.

## Service Assumptions

- Default service URL: `http://127.0.0.1:4765`
- Default command to start the service:

```bash
node ./src/cli.mjs serve
```

- The CLI talks to the service using `AGENTPASS_BASE_URL` when set.

Useful environment variables:

- `AGENTPASS_BASE_URL`: override the service base URL
- `AGENTPASS_DATA_DIR`: override the default data directory for `serve`
- `AGENTPASS_ACTOR_TYPE`: audit actor type for CLI calls
- `AGENTPASS_ACTOR_ID`: audit actor id for CLI calls

If you are automating a task, set `AGENTPASS_ACTOR_ID` to something specific so audit logs remain readable.

Example:

```bash
AGENTPASS_ACTOR_ID=browser-login node ./src/cli.mjs status
```

## Startup Checklist

1. Ensure the AgentPass service is running.
2. Run `node ./src/cli.mjs status`.
3. If the service is unreachable, start it with `node ./src/cli.mjs serve`.
4. If the vault is uninitialized, ask the human to initialize it.
5. If the vault is locked, ask the human to unlock it.
6. Once unlocked, use `node ./src/cli.mjs get-entry <label> --output handles`, or fall back to `node ./src/cli.mjs list --type <type> --match <text> --json`, to discover entries and field handles.

Do not ask the human to paste the master passphrase into normal chat. If unlock is required, instruct the human to unlock through a trusted local prompt or terminal.

## Security Rules

- Never ask for the master passphrase in normal chat.
- Never store the master passphrase in files, templates, notes, command history examples, or task plans.
- Do not read the encrypted vault file directly.
- Do not invent raw secret export commands.
- Do not dump raw secret values into chat unless the user explicitly requests it and the workflow truly requires it.
- Prefer handles in conversation, plans, logs, and file content where possible.
- Respect field policy restrictions such as allowed origins and allowed use modes.

## Core CLI Reference

### Service And State

Start the service:

```bash
node ./src/cli.mjs serve [--host 127.0.0.1] [--port 4765] [--data-dir ~/.agentpass] [--vault <path>] [--log-dir <path>]
```

Check status:

```bash
node ./src/cli.mjs status
```

Initialize a vault:

```bash
node ./src/cli.mjs init
```

Unlock a vault:

```bash
node ./src/cli.mjs unlock
```

Lock a vault:

```bash
node ./src/cli.mjs lock
```

Expected `status` fields:

- `dataDir`
- `vaultPath`
- `logDir`
- `initialized`
- `locked`
- `entryCount`

### Discovering Entries And Handles

Human-readable listing:

```bash
node ./src/cli.mjs list
```

Filtered listing:

```bash
node ./src/cli.mjs list --type login --match costco
node ./src/cli.mjs list --tag prod --json
```

Structured listing:

```bash
node ./src/cli.mjs list --json
```

Direct entry lookup:

```bash
node ./src/cli.mjs get-entry Costco
node ./src/cli.mjs get-entry Costco --output handles
node ./src/cli.mjs get-entry Costco --output handle --field-name password
```

Use `get-entry` when you already know the label or id and want one entry or one handle without scanning the entire vault. Use `--json` whenever you need to programmatically inspect entry labels, types, field ids, handles, or masked previews.

### Creating Entries

Add a login entry:

```bash
node ./src/cli.mjs add-login \
  --label "Costco" \
  --site "https://www.costco.com" \
  --username "ray@example.com" \
  --email "ray@example.com" \
  --password "super-secret-password" \
  --totp-seed "JBSWY3DPEHPK3PXP" \
  --notes "optional" \
  --tags "shopping,personal"
```

Add a login entry with prompts:

```bash
node ./src/cli.mjs add-login --label "Costco" --site "https://www.costco.com" --prompt
```

Add a login entry while reading a secret from stdin:

```bash
printf 'super-secret-password\n' | node ./src/cli.mjs add-login \
  --label "Costco" \
  --password - \
  --output handle \
  --field-name password
```

Supported login flags:

- `--label <label>`
- `--site <url>`
- `--notes <text>`
- `--tags <csv>`
- `--username <value>`
- `--email <value>`
- `--password <value>`
- `--totp-seed <value>`
- `--prompt`
- `--prompt-username`
- `--prompt-email`
- `--prompt-password`
- `--prompt-totp`
- `--output json|id|handle|handles`
- `--field-name <name>` when `--output handle` is used

Passing `-` for `--password`, `--totp-seed`, or another direct secret flag reads the value from stdin instead of exposing it in the command line.

Add a card entry:

```bash
node ./src/cli.mjs add-card \
  --label "Chase Visa" \
  --issuer "Chase" \
  --cardholder-name "Ray Lin" \
  --card-number "4111111111111111" \
  --expiry-month "12" \
  --expiry-year "2030" \
  --cvv "123" \
  --billing-postal-code "94105" \
  --notes "optional" \
  --tags "finance"
```

Supported card flags:

- `--label <label>`
- `--issuer <issuer>`
- `--notes <text>`
- `--tags <csv>`
- `--cardholder-name <value>`
- `--card-number <value>`
- `--expiry-month <value>`
- `--expiry-year <value>`
- `--cvv <value>`
- `--billing-postal-code <value>`
- `--prompt`
- `--prompt-name`
- `--prompt-number`
- `--prompt-month`
- `--prompt-year`
- `--prompt-cvv`
- `--prompt-postal`
- `--output json|id|handle|handles`
- `--field-name <name>` when `--output handle` is used

Add a free-form secret bundle:

```bash
node ./src/cli.mjs add-secret \
  --label "Cloudflare" \
  --provider "Cloudflare" \
  --field api_token=super-secret-token \
  --field account_id=acct_123 \
  --field zone_id=zone_456 \
  --notes "optional" \
  --tags "infra,prod"
```

Supported secret flags:

- `--label <label>`
- `--provider <name>`
- `--field <name=value>` repeated as needed
- `--notes <text>`
- `--tags <csv>`
- `--prompt`
- `--output json|id|handle|handles`
- `--field-name <name>` when `--output handle` is used

Use `--prompt` when the human should enter secret values interactively instead of embedding them in the command line. Passing `--field name=-` reads that field value from stdin.

### Editing Entries And Fields

Edit entry metadata:

```bash
node ./src/cli.mjs edit-entry <entry-id-or-label> [--label <label>] [--site <url>] [--issuer <issuer>] [--provider <name>] [--notes <text>] [--tags <csv>]
```

Edit a field value or field policy:

```bash
node ./src/cli.mjs edit-field <field-id-or-handle> [--value <value>] [--prompt] [--disabled true|false] [--allow-mode <mode>] [--allow-modes <csv>] [--allow-origins <csv>]
```

Important field-policy behavior:

- `--disabled true` disables use of that field.
- `--allow-mode <mode>` can be repeated.
- `--allow-modes <csv>` is also accepted.
- `--allow-origins <csv>` restricts browser origins.
- Passing `--value -` reads the updated value from stdin.

Use `edit-field` to update passwords, TOTP seeds, API tokens, or per-field access policy.

### Removing Data

Remove an entry:

```bash
node ./src/cli.mjs remove-entry <entry-id-or-label>
```

Remove a field:

```bash
node ./src/cli.mjs remove-field <field-id-or-handle>
```

### Using Secrets

Generate a TOTP code:

```bash
node ./src/cli.mjs totp <handle>
```

Print only the 6-digit code:

```bash
node ./src/cli.mjs totp <handle> --code-only
```

This returns JSON with at least:

- `handle`
- `code`
- `expiresAt`

Use this for MFA flows when you already know the TOTP field handle.

### File Rendering

Render a template containing handles:

```bash
node ./src/cli.mjs render-file ./examples/login.template.txt
```

Render a template from stdin:

```bash
printf 'password={{ COSTCO_PASSWORD_1 }}\n' | node ./src/cli.mjs render-file -
```

Render to a chosen output path:

```bash
node ./src/cli.mjs render-file ./examples/login.template.txt --output ./tmp/rendered.txt
```

Render a file and run a command against it:

```bash
node ./src/cli.mjs render-file ./examples/login.template.txt -- \
  node -e "console.log(require('node:fs').readFileSync(process.argv[1], 'utf8'))" \
  AGENTPASS_RENDERED_FILE
```

Supported render-file flags:

- `--output <path>`
- `--keep`
- `--cwd <dir>`
- `--timeout-ms <ms>`
- `-- <command ...>` optional command tail

Behavior notes:

- Templates can use either bare handles or `{{ HANDLE }}` syntax.
- If a command is supplied, its stdout and stderr are redacted so known secret values are replaced with handles.
- If the command tail contains `AGENTPASS_RENDERED_FILE`, that placeholder is replaced with the rendered file path.
- Temporary rendered files are cleaned up by default unless `--keep` or `--output` is supplied.
- If no command is supplied, the CLI prints JSON describing the rendered file.

### Browser Automation

Run a browser template script:

```bash
node ./src/cli.mjs browser-template ./examples/playwright.template.mjs
```

Supported browser-template flags:

- `--cwd <dir>`
- `--timeout-ms <ms>`
- `-- [args ...]`

The template process runs with `AGENTPASS_BASE_URL` set so it can call the local AgentPass service.

The repository includes a browser helper at `src/lib/browser-helper.mjs` that supports:

- `fillHandle(page, selector, handle, origin?)`
- `fillLogin(page, config)`
- `click(page, selector)`
- `totp(handle)`

The helper redacts resolved secret values from stdout and stderr after it registers them.

### Logs

Read audit logs:

```bash
node ./src/cli.mjs logs
node ./src/cli.mjs logs --limit 200
node ./src/cli.mjs logs --json
```

Use logs when you need to confirm whether a handle use, policy denial, render, unlock, or browser fill occurred.

## Browser MCP Guidance

If Browser MCP or another browser-automation tool is available, combine it with AgentPass like this:

1. Use AgentPass CLI to confirm the vault is unlocked and to discover handles with `get-entry ... --output handles` or `list --json`.
2. Use Browser MCP to inspect the page, determine the login flow, and identify stable selectors.
3. If the task is a simple interactive test and a TOTP code is needed, use `node ./src/cli.mjs totp <handle> --code-only` for the MFA step.
4. For actual credential filling, prefer an AgentPass browser template that imports `createAgentPassBrowser()` and calls `fillHandle()` or `fillLogin()`.
5. Use Browser MCP for navigation, verification, and post-login checks; use AgentPass browser templates for secret resolution and form filling.

Reason: Browser MCP can inspect and drive the browser, but AgentPass already provides the safe handle-to-secret resolution path through its browser helper. Do not work around that by inventing a raw password retrieval flow.

If selectors are unknown, inspect them first with Browser MCP, then write or adapt a small local template script and run it with `browser-template`.

Minimal Playwright template pattern:

```js
import { chromium } from "playwright";
import { createAgentPassBrowser } from "../src/lib/browser-helper.mjs";

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();
const secrets = await createAgentPassBrowser();

await page.goto("https://example.com/login");
await secrets.fillHandle(page, "#username", "EXAMPLE_USERNAME_1", "https://example.com");
await secrets.fillHandle(page, "#password", "EXAMPLE_PASSWORD_1", "https://example.com");
const otp = await secrets.totp("EXAMPLE_TOTP_SEED_1");
await page.fill("#otp", otp.code);
await page.click("button[type=submit]");
```

Run it with:

```bash
node ./src/cli.mjs browser-template ./path/to/template.mjs
```

## Recommended Workflows

### Discover Handles For A Site

1. Run `node ./src/cli.mjs status`.
2. If locked, ask the human to unlock.
3. Prefer `node ./src/cli.mjs get-entry <label> --output handles` when the entry is known.
4. Otherwise use `node ./src/cli.mjs list --type <type> --match <text> --json`.
5. Extract the needed handle names from the returned fields.

### Update A Password Or Token

1. Discover the existing field handle with `get-entry ... --output handles` or `list --json`.
2. Run `node ./src/cli.mjs edit-field <handle> --prompt` if the human should enter the new value.
3. Use `--value -` if the replacement secret should come from stdin instead of interactive prompt.
4. If needed, update policy in the same command with `--allow-mode` or `--allow-origins`.

### Log Into A Site

1. Confirm the vault is unlocked.
2. Discover username, email, password, and optional TOTP handles with `get-entry ... --output handles` or `list --json`.
3. Use Browser MCP to inspect the login page and determine selectors or login sequence.
4. Execute a browser template that uses `createAgentPassBrowser()` and `fillHandle()` or `fillLogin()`.
5. If MFA is required, use `secrets.totp(handle)` inside the template or `node ./src/cli.mjs totp <handle> --code-only` if the code must be entered manually.
6. Verify successful login using Browser MCP or the browser automation script.

### Render A Secret-Populated File

1. Confirm the vault is unlocked.
2. Ensure the template contains handles, not raw secrets. Bare handles and `{{ HANDLE }}` are both supported.
3. Run `node ./src/cli.mjs render-file <template>` with `--output` or a command tail, or use `render-file -` to pass the template via stdin.
4. Use the rendered file only for the local execution step that needs it.
5. Rely on default temp-file cleanup unless you intentionally need `--keep` or `--output`.

## Error Handling

If the CLI reports a connection failure:

- The service is likely not running.
- Start it with `node ./src/cli.mjs serve`.

If the CLI reports the vault is locked:

- Stop the secret-use workflow.
- Ask the human to unlock the vault locally.

If a handle is not found:

- Re-run `list --json` and verify the exact handle.
- Check whether the entry label has changed.

If a browser fill or TOTP request is denied:

- Inspect field policy.
- Update it with `edit-field` only if the user intends to widen access.

If a browser template exits non-zero:

- Inspect selectors, origin restrictions, and whether Playwright is installed.

## Decision Rules For Agents

- Need one entry or one handle: use `get-entry`.
- Need structure across many entries: use `list --json`.
- Need a one-time code: use `totp <handle>` or `totp <handle> --code-only`.
- Need a file with substitutions: use `render-file`.
- Need to log into a website: use Browser MCP to inspect and AgentPass browser-template to fill.
- Need to create or rotate credentials: use `add-*` or `edit-field`.
- Need audit confirmation: use `logs`.
- Need unlock: ask the human to unlock locally.

Do not bypass these workflows by reading vault files, inventing export commands, or placing raw secrets into general chat when a handle-based or runtime-resolution path exists.
