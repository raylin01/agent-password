import http from "node:http";
import path from "node:path";

import { sendHtml, sendJson, sendNotFound, readJsonBody } from "./lib/http.mjs";
import { AgentPassService, isLockedError } from "./lib/service.mjs";

function renderPage({ vaultPath }) {
  const escapedVaultPath = JSON.stringify(vaultPath);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AgentPass</title>
    <style>
      :root {
        --bg: #f6f1e8;
        --panel: #fffaf1;
        --ink: #1c1917;
        --muted: #6b6359;
        --line: #d8ccb9;
        --accent: #0f766e;
        --accent-strong: #115e59;
        --danger: #b91c1c;
        --shadow: 0 18px 40px rgba(28, 25, 23, 0.12);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: "Iowan Old Style", "Palatino Linotype", serif;
        background:
          radial-gradient(circle at top left, rgba(15, 118, 110, 0.14), transparent 30%),
          linear-gradient(180deg, #f9f4ea 0%, #f1e5d2 100%);
        color: var(--ink);
      }

      .shell {
        width: min(1080px, calc(100vw - 32px));
        margin: 32px auto 64px;
      }

      .hero {
        display: grid;
        gap: 16px;
        padding: 28px;
        border: 1px solid rgba(28, 25, 23, 0.08);
        background: rgba(255, 250, 241, 0.84);
        box-shadow: var(--shadow);
        border-radius: 28px;
        backdrop-filter: blur(12px);
      }

      .hero h1 {
        margin: 0;
        font-size: clamp(2.4rem, 5vw, 4.2rem);
        line-height: 0.95;
        letter-spacing: -0.06em;
      }

      .hero p {
        margin: 0;
        max-width: 70ch;
        color: var(--muted);
        font-size: 1rem;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 18px;
        margin-top: 18px;
      }

      .card {
        background: var(--panel);
        border-radius: 22px;
        padding: 22px;
        border: 1px solid var(--line);
        box-shadow: var(--shadow);
      }

      .card h2 {
        margin: 0 0 14px;
        font-size: 1.2rem;
      }

      label {
        display: block;
        font-size: 0.9rem;
        margin-bottom: 6px;
      }

      input, select, textarea, button {
        width: 100%;
        font: inherit;
      }

      input, select, textarea {
        padding: 12px 14px;
        border-radius: 14px;
        border: 1px solid var(--line);
        background: #fffefb;
        margin-bottom: 12px;
      }

      textarea {
        min-height: 96px;
        resize: vertical;
      }

      button {
        border: 0;
        cursor: pointer;
        border-radius: 999px;
        padding: 12px 16px;
        color: white;
        background: linear-gradient(135deg, var(--accent), var(--accent-strong));
      }

      button.secondary {
        background: #e7ddd0;
        color: var(--ink);
      }

      button.danger {
        background: var(--danger);
      }

      .button-row {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }

      .button-row button {
        width: auto;
        min-width: 120px;
      }

      .status {
        display: grid;
        gap: 8px;
        font-size: 0.95rem;
      }

      .pill {
        display: inline-block;
        width: fit-content;
        padding: 6px 10px;
        border-radius: 999px;
        background: rgba(15, 118, 110, 0.1);
        color: var(--accent-strong);
      }

      .danger-pill {
        background: rgba(185, 28, 28, 0.12);
        color: var(--danger);
      }

      .entry-list {
        display: grid;
        gap: 14px;
      }

      .entry {
        border: 1px solid var(--line);
        border-radius: 18px;
        padding: 16px;
        background: rgba(255, 255, 255, 0.72);
      }

      .entry h3 {
        margin: 0 0 4px;
      }

      .entry small {
        color: var(--muted);
      }

      .field {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 8px;
        align-items: center;
        border-top: 1px dashed var(--line);
        padding-top: 10px;
        margin-top: 10px;
      }

      .field code {
        display: inline-block;
        padding: 4px 8px;
        border-radius: 999px;
        background: #efe5d8;
      }

      pre {
        margin: 0;
        padding: 14px;
        border-radius: 16px;
        background: #14110f;
        color: #f6f1e8;
        overflow: auto;
      }

      .hint {
        color: var(--muted);
        font-size: 0.9rem;
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="hero">
        <div class="pill">Local vault with opaque handles</div>
        <h1>AgentPass</h1>
        <p>
          This vault keeps the real secret values out of normal agent context. Your agent only sees handles like
          <code>COSTCO_COM_PASSWORD_1</code>, and the local runtime swaps those handles for the real values right before execution.
        </p>
      </section>

      <section class="grid">
        <article class="card">
          <h2>Vault Status</h2>
          <div class="status" id="status"></div>
          <div class="button-row" style="margin-top: 14px;">
            <button type="button" id="refresh-status" class="secondary">Refresh</button>
            <button type="button" id="lock-vault" class="danger">Lock</button>
          </div>
        </article>

        <article class="card">
          <h2>Init Or Unlock</h2>
          <label for="passphrase">Passphrase</label>
          <input id="passphrase" type="password" autocomplete="current-password" />
          <div class="button-row">
            <button type="button" id="init-vault">Initialize Vault</button>
            <button type="button" id="unlock-vault" class="secondary">Unlock Vault</button>
          </div>
          <p class="hint" style="margin-top: 12px;">Vault path: <code>${escapedVaultPath}</code></p>
        </article>

        <article class="card">
          <h2>Add Or Update Secret</h2>
          <label for="entry-key">Entry Key</label>
          <input id="entry-key" placeholder="costco.com" />

          <label for="entry-label">Label</label>
          <input id="entry-label" placeholder="Costco" />

          <label for="field-name">Field Name</label>
          <input id="field-name" placeholder="password" />

          <label for="field-type">Field Type</label>
          <select id="field-type">
            <option value="password">password</option>
            <option value="text">text</option>
            <option value="totp">totp</option>
          </select>

          <label for="field-value">Value</label>
          <textarea id="field-value" placeholder="Paste the real secret here"></textarea>

          <button type="button" id="save-field">Save Field</button>
        </article>

        <article class="card">
          <h2>CLI Pattern</h2>
          <pre>agentpass list
agentpass put costco.com username --type text --prompt
agentpass put costco.com password --type password --prompt
agentpass run -- node browser-script.mjs COSTCO_COM_USERNAME_1 COSTCO_COM_PASSWORD_1</pre>
        </article>
      </section>

      <section class="card" style="margin-top: 18px;">
        <h2>Entries</h2>
        <div id="entries" class="entry-list"></div>
      </section>
    </main>

    <script>
      const statusRoot = document.querySelector("#status");
      const entriesRoot = document.querySelector("#entries");

      async function api(path, options = {}) {
        const response = await fetch(path, {
          headers: {
            "content-type": "application/json"
          },
          ...options
        });

        const body = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(body.error || "Request failed");
        }

        return body;
      }

      function renderStatus(status) {
        const lockedBadge = status.locked
          ? '<span class="pill danger-pill">Locked</span>'
          : '<span class="pill">Unlocked</span>';
        const initialized = status.initialized ? "yes" : "no";
        statusRoot.innerHTML = [
          lockedBadge,
          '<div><strong>Initialized:</strong> ' + initialized + '</div>',
          '<div><strong>Entries:</strong> ' + status.entryCount + '</div>',
          '<div><strong>Vault:</strong> <code>' + status.vaultPath + '</code></div>'
        ].join("");
      }

      function renderEntries(entries) {
        if (!entries.length) {
          entriesRoot.innerHTML = '<p class="hint">No entries yet.</p>';
          return;
        }

        entriesRoot.innerHTML = entries.map((entry) => {
          const fields = entry.fields.map((field) => {
            return '<div class="field">' +
              '<div><strong>' + field.name + '</strong> <small>(' + field.type + ', ' + field.preview + ')</small><br /><code>' + field.handle + '</code></div>' +
              '<button type="button" data-copy="' + field.handle + '" class="secondary">Copy Handle</button>' +
            '</div>';
          }).join("");

          return '<section class="entry">' +
            '<h3>' + entry.label + '</h3>' +
            '<small>' + entry.key + '</small>' +
            fields +
          '</section>';
        }).join("");

        document.querySelectorAll("[data-copy]").forEach((button) => {
          button.addEventListener("click", async () => {
            await navigator.clipboard.writeText(button.dataset.copy);
            button.textContent = "Copied";
            setTimeout(() => {
              button.textContent = "Copy Handle";
            }, 1200);
          });
        });
      }

      async function loadStatus() {
        const status = await api("/api/status");
        renderStatus(status);
        return status;
      }

      async function loadEntries() {
        try {
          const entries = await api("/api/entries");
          renderEntries(entries);
        } catch (error) {
          entriesRoot.innerHTML = '<p class="hint">' + error.message + '</p>';
        }
      }

      async function refreshAll() {
        await loadStatus();
        await loadEntries();
      }

      document.querySelector("#refresh-status").addEventListener("click", refreshAll);
      document.querySelector("#lock-vault").addEventListener("click", async () => {
        await api("/api/lock", {
          method: "POST"
        });
        await refreshAll();
      });

      document.querySelector("#init-vault").addEventListener("click", async () => {
        const passphrase = document.querySelector("#passphrase").value;
        await api("/api/init", {
          method: "POST",
          body: JSON.stringify({ passphrase })
        });
        document.querySelector("#passphrase").value = "";
        await refreshAll();
      });

      document.querySelector("#unlock-vault").addEventListener("click", async () => {
        const passphrase = document.querySelector("#passphrase").value;
        await api("/api/unlock", {
          method: "POST",
          body: JSON.stringify({ passphrase })
        });
        document.querySelector("#passphrase").value = "";
        await refreshAll();
      });

      document.querySelector("#save-field").addEventListener("click", async () => {
        await api("/api/fields", {
          method: "POST",
          body: JSON.stringify({
            entryKey: document.querySelector("#entry-key").value,
            label: document.querySelector("#entry-label").value,
            name: document.querySelector("#field-name").value,
            type: document.querySelector("#field-type").value,
            value: document.querySelector("#field-value").value
          })
        });

        document.querySelector("#field-name").value = "";
        document.querySelector("#field-value").value = "";
        await refreshAll();
      });

      refreshAll().catch((error) => {
        statusRoot.innerHTML = '<span class="pill danger-pill">Error</span><div>' + error.message + '</div>';
      });
    </script>
  </body>
</html>`;
}

export async function startServer({ host = "127.0.0.1", port = 4765, vaultPath }) {
  const service = new AgentPassService({
    vaultPath: path.resolve(vaultPath)
  });

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`);

    try {
      if (request.method === "GET" && url.pathname === "/") {
        sendHtml(response, renderPage({ vaultPath: service.vaultPath }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/status") {
        sendJson(response, 200, await service.status());
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/init") {
        const body = await readJsonBody(request);
        sendJson(response, 200, await service.init(body.passphrase));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/unlock") {
        const body = await readJsonBody(request);
        sendJson(response, 200, await service.unlock(body.passphrase));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/lock") {
        sendJson(response, 200, service.lock());
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/entries") {
        sendJson(response, 200, service.listEntries());
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/fields") {
        const body = await readJsonBody(request);
        sendJson(response, 200, await service.putField(body));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/run") {
        const body = await readJsonBody(request);
        sendJson(response, 200, await service.runCommand(body));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/run-template") {
        const body = await readJsonBody(request);
        sendJson(response, 200, await service.runTemplate(body));
        return;
      }

      sendNotFound(response);
    } catch (error) {
      const statusCode = isLockedError(error) ? 423 : 400;
      sendJson(response, statusCode, {
        error: error.message
      });
    }
  });

  await new Promise((resolve) => {
    server.listen(port, host, resolve);
  });

  return {
    host,
    port,
    server,
    service
  };
}
