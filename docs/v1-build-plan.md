# AgentPass V1 Build Plan

Date: April 9, 2026
Status: Locked Plan For Next Implementation Pass

## Purpose

This document turns the PRD into a concrete V1 implementation plan.

The goal is that the next build pass can start coding immediately without reopening product scope questions.

## V1 Scope

V1 will ship with:

- encrypted local vault
- human web UI
- agent CLI
- login secrets
- credit card secrets
- TOTP generation
- browser replacement
- file replacement
- append-only audit logging
- minimal per-field use policy

V1 will not ship with:

- full MCP server
- multi-user support
- browser extension
- background daemon as a hard requirement
- encrypted sync across machines

We will build V1 so MCP and sync can be added later without rewriting core storage.

## Locked Product Decisions

### 1. Interface Decisions

V1 surfaces:

- human web UI over local HTTP
- agent CLI
- internal service layer shared by UI and CLI

MCP is deferred to V1.1.

Reason:

- CLI is enough for agent use now
- web UI is enough for human use now
- deferring MCP keeps V1 implementable in one pass

### 2. Storage Decisions

Default local data directory:

- `~/.agentpass/`

Default files:

- `~/.agentpass/vault.enc.json`
- `~/.agentpass/config.json`
- `~/.agentpass/logs/audit-YYYY-MM-DD.jsonl`

Workspace-local paths may be allowed by config, but the default should be outside the agent workspace.

### 3. Logging Decisions

Audit logs will be:

- stored outside the workspace by default
- written only by the app service layer
- append-only JSONL
- hash-chained for tamper evidence

This is not perfect same-user protection, but it is the strongest practical V1 without a dedicated daemon.

### 4. Browser Replacement Decision

V1 browser replacement will use a Playwright helper library and template runner.

It will not try to intercept arbitrary browser tools or browser sessions.

Reason:

- this is concrete and implementable
- it keeps raw secret handling inside trusted helper code
- it gives agents a safe browser path now

### 5. File Replacement Decision

V1 file replacement will render templates containing handles into temporary local files and clean them up after use.

### 6. Policy Decision

V1 will include a minimal policy model on each sensitive field:

- `allowed_use_modes`
- `allowed_origins`
- `disabled`

Supported use modes:

- `browser_fill`
- `file_render`
- `totp_generate`

We will not build full approval workflows in V1.

## V1 Data Model

### Entry Types

#### Login Entry

Fields:

- label
- site
- username
- email
- password
- totp_seed
- notes
- tags

Sensitive fields:

- username
- email
- password
- totp_seed

#### Credit Card Entry

Fields:

- label
- issuer or site
- cardholder_name
- card_number
- expiry_month
- expiry_year
- cvv
- billing_postal_code
- notes
- tags

Sensitive fields:

- card_number
- expiry_month
- expiry_year
- cvv
- billing_postal_code

### Field Shape

Each sensitive field record will contain:

- `id`
- `entry_id`
- `handle`
- `field_name`
- `field_type`
- `value_encrypted`
- `preview_masked`
- `policy`
- `created_at`
- `updated_at`
- `last_used_at`

### Policy Shape

Each field policy will contain:

- `disabled`
- `allowed_use_modes`
- `allowed_origins`

Defaults:

- `disabled = false`
- `allowed_use_modes` based on field type
- `allowed_origins = []` meaning no origin restriction unless browser mode is used

Browser rule:

- if `allowed_origins` is non-empty, browser use must match one of them
- if `allowed_origins` is empty, browser use is allowed on any origin in V1

## V1 Architecture

### Components

- Vault Store
- Crypto Layer
- Audit Logger
- TOTP Engine
- Policy Checker
- File Render Runtime
- Playwright Helper Runtime
- Local HTTP Server
- Human Web UI
- Agent CLI

### High-Level Flow

1. Human unlocks vault.
2. Decrypted vault is held in memory in the local process.
3. UI and CLI call the same service layer.
4. Sensitive use actions go through the policy checker.
5. Secret value is resolved only inside trusted runtime code.
6. Audit event is written.
7. Result returns success or failure, not the secret value.

## Source Layout

Planned target layout:

- `src/cli.mjs`
- `src/server.mjs`
- `src/lib/crypto.mjs`
- `src/lib/paths.mjs`
- `src/lib/vault-file.mjs`
- `src/lib/vault-schema.mjs`
- `src/lib/vault-service.mjs`
- `src/lib/audit-log.mjs`
- `src/lib/totp.mjs`
- `src/lib/policy.mjs`
- `src/lib/substitution.mjs`
- `src/lib/temp-files.mjs`
- `src/lib/browser-helper.mjs`
- `src/ui/page.mjs`
- `src/ui/static/`
- `tests/`
- `examples/`

We should reuse the current MVP files where possible rather than rewrite from scratch.

## CLI Plan

### Required Commands

- `agentpass serve`
- `agentpass init`
- `agentpass unlock`
- `agentpass lock`
- `agentpass status`
- `agentpass list`
- `agentpass add-login`
- `agentpass add-card`
- `agentpass edit-field`
- `agentpass remove-entry`
- `agentpass remove-field`
- `agentpass totp`
- `agentpass render-file`
- `agentpass browser-template`
- `agentpass logs`

### Command Behavior

`add-login`

- creates a login entry
- accepts username, email, password, TOTP seed, notes, tags
- generates stable handles for sensitive fields
- writes audit log event

`add-card`

- creates a credit card entry
- accepts card fields
- generates stable handles for sensitive fields
- writes audit log event

`totp`

- accepts a TOTP handle
- checks policy
- generates code locally
- returns code only, never seed
- writes audit log event

`render-file`

- accepts a template path
- renders handles into a temp file
- optionally runs a command against that temp file
- cleans up temp file
- writes audit log event

`browser-template`

- accepts a Playwright template path
- provides helper API for browser filling using handles
- writes audit log events for each fill

`logs`

- reads and prints redacted audit logs
- must be read-only

## HTTP API Plan

The local HTTP API is internal for the UI and CLI.

### Required Endpoints

- `GET /api/status`
- `POST /api/init`
- `POST /api/unlock`
- `POST /api/lock`
- `GET /api/entries`
- `POST /api/entries/login`
- `POST /api/entries/card`
- `PATCH /api/fields/:fieldId`
- `DELETE /api/entries/:entryId`
- `DELETE /api/fields/:fieldId`
- `POST /api/totp`
- `POST /api/render-file`
- `GET /api/logs`

These endpoints must never return raw stored secret values in list or management views.

## Browser Replacement Plan

### V1 Approach

Browser support in V1 will be Playwright-template-based.

We will provide a small helper module with functions such as:

- `fillHandle(page, selector, handle, origin)`
- `fillLogin(page, config)`
- `click(page, selector)`
- `totp(handle)`

Rules:

- helper functions may internally resolve handles
- helper functions must not expose a generic raw secret getter
- each helper call must audit
- browser fill must enforce per-field policy

### Example Usage Shape

```js
import { createAgentPassBrowser } from "../src/lib/browser-helper.mjs";

const secrets = await createAgentPassBrowser();
await secrets.fillHandle(page, "#username", "COSTCO_COM_USERNAME_1", "https://www.costco.com");
await secrets.fillHandle(page, "#password", "COSTCO_COM_PASSWORD_1", "https://www.costco.com");
```

## File Replacement Plan

### V1 Approach

File replacement uses templates with handles such as:

```text
username=COSTCO_COM_USERNAME_1
password=COSTCO_COM_PASSWORD_1
```

The render flow:

1. read template
2. replace handles
3. write temp file with `0600`
4. optionally execute a command using the temp file
5. delete temp file
6. audit the operation

## Audit Logging Plan

### Log Record Format

Each log line will be canonical JSON with:

- `event_id`
- `timestamp`
- `actor_type`
- `actor_id`
- `action`
- `target_type`
- `target_id`
- `handle`
- `origin`
- `file_path`
- `result`
- `message`
- `prev_hash`
- `event_hash`

### Hash Chain Rule

`event_hash` will be:

- SHA-256 of canonical event JSON plus `prev_hash`

This gives tamper evidence for log inspection even if same-user local protection is imperfect.

### Minimum Logged Actions

- vault init
- vault unlock
- vault lock
- add login
- add card
- edit field
- remove entry
- remove field
- totp generation
- browser fill
- file render
- failed policy check
- failed secret lookup

## Encryption Plan

### V1 Encryption

Keep the current encrypted-file approach and harden it:

- AES-256-GCM
- scrypt-derived key from passphrase
- atomic writes
- `0600` permissions

### Unlock Behavior

- vault decrypts only after unlock
- decrypted state stays in process memory only
- lock clears in-memory vault and passphrase

## TOTP Plan

### V1 TOTP Support

We will implement RFC 6238-compatible TOTP generation using stored encrypted seed values.

Requirements:

- no seed reveal in normal UI or CLI
- code generation by handle only
- default 6 digits, 30 second period
- audit every generation

## UI Plan

### Required Screens

- setup or unlock view
- entries list
- add login form
- add card form
- edit entry or field form
- logs view

### Required UI Behaviors

- raw values hidden by default
- masked previews shown
- copy handle action
- per-field policy editor for use modes and origins
- delete confirmation for destructive actions

## Migration Plan From Current MVP

### Keep

- current crypto module
- current vault file pattern
- current local server approach
- current opaque handle approach

### Replace Or Extend

- replace generic `put` model with typed entry models
- replace generic `run` emphasis with `render-file` and browser helper
- add audit logger
- add TOTP engine
- add card entry type
- add policy checks
- expand UI

### Compatibility Decision

If the existing vault schema is too loose for typed entries, add a one-time migration step:

- schema version bump
- migration function from loose fields to typed entry schema

If no real data exists yet, a clean schema reset is acceptable.

## Implementation Order

### Milestone 1: Core Model And Logging

Build:

- path config
- typed vault schema
- audit log writer and reader
- policy checker
- TOTP generator

Done when:

- login and card entries can be represented cleanly
- log events append correctly with hash chain
- TOTP codes generate from stored seed

### Milestone 2: Service Layer

Build:

- typed CRUD operations
- secret field masking
- field removal
- entry removal
- safe handle lookup
- use-event logging

Done when:

- service tests cover add, edit, remove, list, TOTP, and policy checks

### Milestone 3: CLI

Build:

- new CLI commands
- CLI prompts for secret fields
- CLI logs command results safely

Done when:

- an agent can manage entries and use TOTP and file render from CLI only

### Milestone 4: Web UI

Build:

- typed forms
- entries list
- logs view
- policy editor

Done when:

- a human can manage all V1 entry types from the browser

### Milestone 5: File Replacement

Build:

- template renderer
- temp file manager
- cleanup flow
- audit integration

Done when:

- handle templates render and clean up correctly

### Milestone 6: Browser Replacement

Build:

- Playwright helper module
- origin checks
- fill helpers
- audit integration

Done when:

- a Playwright template can fill username, password, TOTP, and card fields by handle

### Milestone 7: Integration And Hardening

Build:

- end-to-end tests
- migration handling
- docs update
- example templates

Done when:

- all acceptance criteria pass

## Test Plan

### Unit Tests

- crypto round-trip
- typed schema validation
- handle generation
- policy matching
- TOTP generation
- substitution logic
- audit hash chain

### Service Tests

- add login
- add card
- edit field
- remove entry
- remove field
- TOTP use
- browser policy allow
- browser policy deny
- file render allow
- file render deny

### Integration Tests

- unlock then create login and card entries
- render a file template with multiple handles
- run Playwright helper against a local test page
- inspect log records and verify no raw secrets appear

## Acceptance Criteria

V1 is complete when all of these are true:

- humans can add, edit, remove, and browse login and card entries in the web UI
- agents can add, edit, remove, and use entries through the CLI
- TOTP can be generated from a handle without exposing the seed
- file templates with handles can be rendered safely
- Playwright templates can fill browser fields using handles
- every action is logged
- logs are stored outside the workspace by default
- logs are append-only and hash-chained
- raw secret values do not appear in normal list, audit, or command output
- vault data is encrypted at rest

## Cut Line

If implementation time becomes tight, keep these as required:

- login entries
- card entries
- TOTP generation
- file replacement
- audit logs
- web UI CRUD
- CLI CRUD

These may be simplified but not removed:

- browser replacement may ship as `fillHandle` only instead of richer helpers
- policy UI may be basic text inputs for origins and checkboxes for use modes

## Next Pass Instructions

On the next implementation pass:

1. Do not revisit V1 scope unless a blocker appears.
2. Keep PRD intact and implement against this build plan.
3. Prefer extending current files over large rewrites.
4. Start with Milestone 1 and continue through Milestone 7 in one pass where feasible.
