# AgentPass

AgentPass is a small local-first password vault for agent workflows.

The core idea is simple:

- The real secret values live only inside an encrypted vault file.
- The agent only sees opaque handles like `COSTCO_COM_PASSWORD_1`.
- A local runtime replaces those handles right before execution.
- Returned process output is redacted so matching secrets are swapped back to their handles.

This protects against accidental context leakage. It does not protect against a malicious agent or a malicious child process that intentionally exfiltrates a secret after the runtime injects it.

## What Is In This MVP

- AES-256-GCM encrypted vault file with a passphrase-derived key via `scrypt`
- Local web UI for initializing, unlocking, adding, and browsing entries
- CLI for listing entries, adding fields, and running commands with handle substitution
- Temporary file execution for script templates such as Playwright or shell helpers

## Quick Start

Start the local service:

```bash
node ./src/cli.mjs serve
```

In another terminal, initialize the vault:

```bash
node ./src/cli.mjs init
```

Add secrets:

```bash
node ./src/cli.mjs put costco.com username --type text --prompt
node ./src/cli.mjs put costco.com password --type password --prompt
```

List the handles that agents can safely use:

```bash
node ./src/cli.mjs list
```

Run a command with replacement:

```bash
node ./src/cli.mjs run -- node -e "console.log(process.argv[1], process.argv[2])" COSTCO_COM_USERNAME_1 COSTCO_COM_PASSWORD_1
```

Run a script template with replacement:

```bash
node ./src/cli.mjs run-template ./examples/playwright.template.mjs -- node
```

Then open [http://127.0.0.1:4765](http://127.0.0.1:4765) in a browser for the UI.

## Security Model

AgentPass is designed to keep secrets out of normal model context and logs. It is not a sandbox for untrusted automation.

What it does well:

- prevents plain secrets from being listed or returned via normal CLI/UI flows
- keeps the at-rest vault encrypted
- swaps secrets in only at execution time
- redacts exact secret values from captured stdout and stderr

What it does not solve:

- an agent can still direct the runtime to submit a secret to the wrong site
- a child process can transform a secret before printing it, which may bypass exact-match redaction
- local malware running as the same user is out of scope

## Next Hardening Steps

- Replace general `run` with narrower execution adapters such as browser fill, env injection, or HTTP auth helpers.
- Add per-handle approval rules and destination allowlists.
- Move the unlocked vault into a separate daemon process with tighter IPC permissions.
- Add file sync or Git-backed encrypted vault sharing once the local flow feels good.
