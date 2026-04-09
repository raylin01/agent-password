# AgentPass Product Requirements Document

Date: April 9, 2026
Status: Draft

## Summary

AgentPass is a local-first encrypted secret manager for agent workflows.

It has two jobs:

1. Let humans and agents manage secrets without casually exposing raw values.
2. Let agents use secrets in browsers and files through temporary handles like `COSTCO_COM_PASSWORD_1` instead of seeing the real secret.

This version of the PRD keeps the scope intentionally small.

## Core Product Requirements

### 1. Secret Management

Humans must be able to:

- add secrets
- edit secrets
- remove secrets
- browse secrets by label, site, and type

Agents must be able to:

- add secrets
- edit secrets
- remove secrets
- use secrets

The system must support at least these secret types:

- login
  - username
  - email
  - password
  - TOTP seed
  - TOTP code generation
- credit card
  - cardholder name
  - card number
  - expiry month
  - expiry year
  - CVV
  - billing ZIP or postal code

Each secret field must have:

- a stable internal ID
- an opaque handle
- a type
- created and updated timestamps
- optional notes and tags

### 2. Secret Use

Agents must use handles, not raw secret values, in normal operation.

Example handles:

- `COSTCO_COM_USERNAME_1`
- `COSTCO_COM_PASSWORD_1`
- `CHASE_CARD_NUMBER_1`

The system must support two replacement modes:

- browser replacement
- file replacement

Browser replacement means:

- the agent passes a handle
- the trusted local runtime resolves the real value
- the runtime fills the browser field directly
- the tool returns success or failure, not the secret value

File replacement means:

- the agent writes a file or template containing handles
- the trusted local runtime creates a temporary rendered version with real values
- the rendered file is used locally
- the temporary file is removed after use

### 3. Logging

Every action must be logged.

Logged actions must include:

- vault created
- vault unlocked
- vault locked
- secret added
- secret edited
- secret removed
- secret used in browser replacement
- secret used in file replacement
- TOTP generated
- credit card field used
- policy changed
- sync action performed
- failed action attempts

Each log record must include:

- timestamp
- actor type: human, agent, or system
- actor identifier where available
- action type
- target secret or handle
- result: success or failure
- relevant target such as domain, file path, or tool name

Logs must never contain raw secret values.

## Security Requirements

### 4. Encryption

Secrets must be encrypted at rest.

Requirements:

- the vault file must be encrypted
- encryption keys must not be stored in plaintext beside the vault
- raw secrets must not be displayed in normal list or audit views
- handles must be shown instead of raw values wherever possible

Important limit:

Encryption protects stored data and accidental disclosure. It does not make secrets unreadable to a fully trusted human operator who unlocks the vault, and it does not fully protect against a malicious local process with the same OS permissions.

So the product goal is:

- safe enough against accidental reading by agents
- reduced casual reading by humans
- strong at-rest protection

Not the impossible goal of making unlocked local secrets unreadable to a determined machine owner.

### 5. Safe Use Boundary

The system should not expose raw secret retrieval as a normal agent tool.

That is why tools like these should not exist in the agent interface:

- `get_secret_value`
- `export_all_secrets`
- raw vault dump

Those are not planned features. They are intentionally excluded because they would defeat the product’s main safety boundary.

Instead, the agent interface should expose narrow actions such as:

- use this handle in browser fill
- use this handle in file replacement
- generate a TOTP code for this handle

## Logging Integrity

### 6. Write Protection For Logs

You are right that logs should not be modifiable by the agent.

Product requirement:

- audit logs must be stored outside the normal agent workspace
- the agent-facing process must not have direct write access to historical log files
- log writes should happen through a trusted local service
- log records should be append-only

Practical note:

If the agent and the trusted service run as the exact same OS user on the same machine, true write protection is limited. A same-user local process can often still tamper with files.

So we should plan this in two levels:

Level 1:

- logs stored outside the workspace
- only the trusted service writes them
- agent tools cannot edit log files directly
- permissions locked down to the local user

Level 2:

- separate daemon or helper process owns the logs
- append-only or tamper-evident log format
- optional separate OS user or protected store on supported systems

For the first production version, Level 1 is required. Level 2 is the hardening path.

## Product Surfaces

### 7. Human UI

The human UI must support:

- create vault
- unlock vault
- lock vault
- add secret
- edit secret
- remove secret
- browse secret handles
- manage TOTP seeds
- manage credit card entries
- view logs
- configure sync

The UI should hide raw values by default.

### 8. Agent Interface

The agent interface may be CLI, MCP, or both.

Minimum supported agent actions:

- add secret
- edit secret
- remove secret
- list handles
- browser fill using handle
- file render using handle
- generate TOTP using handle

The agent interface should not provide “show me the raw secret” behavior.

## Data Model

### 9. Secret Types

#### Login Entry

Fields:

- label
- website or app
- username
- email
- password
- TOTP seed
- notes
- tags

Derived capability:

- TOTP code generation

#### Credit Card Entry

Fields:

- label
- cardholder name
- card number
- expiry month
- expiry year
- CVV
- billing ZIP or postal code
- notes
- tags

### 10. Handles

Each sensitive field gets a handle.

Examples:

- `COSTCO_COM_EMAIL_1`
- `COSTCO_COM_PASSWORD_1`
- `GITHUB_COM_TOTP_1`
- `CHASE_CARD_NUMBER_1`
- `CHASE_CVV_1`

Handles must be stable unless the field is intentionally rotated or replaced.

## Feature Plan

### Phase 1: Usable Core

Deliver:

- encrypted local vault
- human UI for add, edit, remove, browse
- agent CLI and or MCP for add, edit, remove, use
- login secrets with username, email, password, TOTP seed
- TOTP code generation
- credit card entry type
- browser replacement
- file replacement
- full audit logging

### Phase 2: Safety Hardening

Deliver:

- stronger separation between agent-facing tools and storage engine
- append-only or tamper-evident logs
- policy rules per secret or field
- masked previews everywhere
- safer temp file handling and cleanup

### Phase 3: Sync

Deliver:

- encrypted vault sync across machines
- conflict handling
- backup and restore

Sync requirements:

- only encrypted data syncs
- unlocked state does not sync
- logs may stay local first

## Sync Requirements

### 11. Encrypted Sync

The system must support syncing the encrypted vault to a shared file or folder.

Examples:

- synced folder
- Git repository containing only encrypted vault data
- Syncthing folder

Requirements:

- sync never requires plaintext secrets on remote storage
- conflicting updates must not silently overwrite data
- backups must be possible without decrypting the vault

## Open Design Choice: Local Daemon

### 12. Local Daemon Decision

We do not need to force a daemon in the very first production build, but we should design for it.

Why a daemon may help later:

- central place for encryption, replacement, logging, and sync
- easier to keep raw secrets in one trusted runtime
- easier to protect logs from agent modification

Why we may delay it:

- more moving parts
- more process-management complexity
- slower path to a usable first version

Decision for now:

- phase 1 may ship without a full daemon if we keep the trusted runtime small
- phase 2 should likely introduce a dedicated local service for better log integrity and safer secret use

## Success Criteria

The product is successful if:

- a human can add and manage secrets locally in a few minutes
- an agent can use secrets through browser and file replacement without receiving raw values in normal context
- TOTP generation works without exposing the seed
- credit card entries are handled the same way as passwords
- every action is logged
- secrets are encrypted at rest
- synced storage can remain encrypted end to end
