# AgentPass

AgentPass is a local-first encrypted secret vault for agent workflows.

V1 is built around a simple safety boundary:

- humans manage secrets in a local web UI
- agents manage and use secrets through a CLI
- stored values are encrypted at rest
- agents use handles like `COSTCO_COM_PASSWORD_1`
- browser and file flows resolve those handles only at local execution time
- audit logs record every action without storing raw secret values

This is strong protection against accidental leakage into model context and normal logs. It is not full protection against a malicious local process with the same OS permissions.

## V1 Features

- AES-256-GCM encrypted vault file with `scrypt`-derived keys
- login entries with `username`, `email`, `password`, and `TOTP seed`
- credit card entries with `cardholder_name`, `card_number`, `expiry_month`, `expiry_year`, `cvv`, and `billing_postal_code`
- masked previews and opaque handles for sensitive fields
- browser replacement through a Playwright-oriented helper
- file replacement through temporary rendered files
- append-only JSONL audit logs with hash chaining
- minimal per-field policies:
  - `disabled`
  - `allowed_use_modes`
  - `allowed_origins`

## Quick Start

Start the local service:

```bash
node ./src/cli.mjs serve
```

In another terminal, initialize the vault:

```bash
node ./src/cli.mjs init
```

Add a login:

```bash
node ./src/cli.mjs add-login costco.com \
  --label "Costco" \
  --site "https://www.costco.com" \
  --username "ray@example.com" \
  --password "super-secret-password" \
  --totp-seed "JBSWY3DPEHPK3PXP"
```

Add a card:

```bash
node ./src/cli.mjs add-card chase-visa \
  --label "Chase Visa" \
  --issuer "Chase" \
  --cardholder-name "Ray Lin" \
  --card-number "4111111111111111" \
  --expiry-month "12" \
  --expiry-year "2030" \
  --cvv "123" \
  --billing-postal-code "94105"
```

List entries and handles:

```bash
node ./src/cli.mjs list
```

Generate a TOTP code by handle:

```bash
node ./src/cli.mjs totp COSTCO_COM_TOTP_SEED_1
```

Open the web UI:

- [http://127.0.0.1:4765](http://127.0.0.1:4765)

## File Replacement

Render a template with handles:

```bash
node ./src/cli.mjs render-file ./examples/login.template.txt
```

Render a template and run a command against the rendered file:

```bash
node ./src/cli.mjs render-file ./examples/login.template.txt -- \
  node -e "console.log(require('node:fs').readFileSync(process.argv[1], 'utf8'))" \
  AGENTPASS_RENDERED_FILE
```

## Browser Replacement

Smoke-test the browser helper without installing Playwright:

```bash
node ./src/cli.mjs browser-template ./examples/browser-smoke.template.mjs
```

If you already use Playwright in another project, you can use:

```bash
node ./src/cli.mjs browser-template ./examples/playwright.template.mjs
```

## Audit Logs

By default, data lives outside the workspace in `~/.agentpass/`:

- `~/.agentpass/vault.enc.json`
- `~/.agentpass/logs/audit-YYYY-MM-DD.jsonl`

The logs are append-only JSONL with a hash chain for tamper evidence.

## Security Model

What AgentPass does well:

- encrypts the vault at rest
- keeps raw secret values out of normal UI and CLI listing flows
- uses handles instead of raw values in agent-facing workflows
- resolves values only at execution time for browser and file flows
- logs actions without writing raw secret values
- applies simple per-field origin and use-mode policy checks

What AgentPass does not fully solve:

- a malicious local process running as the same OS user can still tamper with data
- a browser automation script can still misuse a secret if policy is too broad
- same-user local log protection is limited without a separate daemon or OS-level boundary

## Tests

Run the automated suite:

```bash
node --test
```
