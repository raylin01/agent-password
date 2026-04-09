function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fieldModeCheckbox(field, mode, label) {
  return `<label class="mode-pill"><input type="checkbox" data-mode="${mode}" ${field.policy.allowedUseModes.includes(mode) ? "checked" : ""} /> ${label}</label>`;
}

export function renderPage({ vaultPath, logDir }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AgentPass</title>
    <style>
      :root {
        --bg: #f5efe5;
        --panel: #fffaf2;
        --ink: #1c1917;
        --muted: #6f665c;
        --line: #d8cdbc;
        --accent: #065f46;
        --accent-soft: #d1fae5;
        --warning: #b45309;
        --danger: #b91c1c;
        --shadow: 0 20px 40px rgba(28, 25, 23, 0.1);
      }

      * { box-sizing: border-box; }
      body {
        margin: 0;
        color: var(--ink);
        font-family: "Iowan Old Style", "Palatino Linotype", serif;
        background:
          radial-gradient(circle at top left, rgba(6, 95, 70, 0.12), transparent 30%),
          linear-gradient(180deg, #fbf6ee 0%, #efe3d2 100%);
      }

      main {
        width: min(1200px, calc(100vw - 32px));
        margin: 24px auto 48px;
      }

      .hero, .panel {
        background: rgba(255, 250, 242, 0.88);
        border: 1px solid rgba(28, 25, 23, 0.08);
        box-shadow: var(--shadow);
        border-radius: 28px;
        backdrop-filter: blur(10px);
      }

      .hero {
        padding: 28px;
        margin-bottom: 20px;
      }

      .hero h1 {
        margin: 8px 0 10px;
        font-size: clamp(2.5rem, 5vw, 4rem);
        line-height: 0.95;
        letter-spacing: -0.06em;
      }

      .hero p, .hint, small {
        color: var(--muted);
      }

      .pill {
        display: inline-block;
        padding: 6px 10px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 0.92rem;
      }

      .grid {
        display: grid;
        gap: 18px;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        margin-bottom: 18px;
      }

      .panel {
        padding: 20px;
      }

      h2, h3 {
        margin-top: 0;
      }

      input, textarea, select, button {
        width: 100%;
        font: inherit;
      }

      input, textarea, select {
        padding: 12px 14px;
        border-radius: 14px;
        border: 1px solid var(--line);
        background: #fffefb;
        margin-bottom: 10px;
      }

      textarea { min-height: 90px; resize: vertical; }

      button {
        border: 0;
        border-radius: 999px;
        cursor: pointer;
        color: white;
        background: linear-gradient(135deg, #0f766e, #115e59);
        padding: 12px 16px;
      }

      button.secondary {
        background: #eadfce;
        color: var(--ink);
      }

      button.danger {
        background: var(--danger);
      }

      .actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }

      .actions button {
        width: auto;
      }

      .status {
        display: grid;
        gap: 8px;
      }

      .entry-list {
        display: grid;
        gap: 16px;
      }

      .entry-card {
        background: rgba(255, 255, 255, 0.72);
        border: 1px solid var(--line);
        border-radius: 22px;
        padding: 18px;
      }

      .field-row {
        border-top: 1px dashed var(--line);
        padding-top: 14px;
        margin-top: 14px;
      }

      .field-grid, .entry-grid {
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      }

      .mode-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 10px;
      }

      .mode-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        background: #efe5d7;
        border-radius: 999px;
        font-size: 0.92rem;
      }

      .mode-pill input {
        width: auto;
        margin: 0;
      }

      code {
        display: inline-block;
        background: #efe4d5;
        padding: 4px 8px;
        border-radius: 999px;
      }

      pre {
        margin: 0;
        padding: 12px;
        background: #1c1917;
        color: #f8f3ea;
        border-radius: 16px;
        overflow: auto;
      }

      .log-list {
        display: grid;
        gap: 10px;
      }

      .log-item {
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 12px;
        background: rgba(255, 255, 255, 0.68);
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <span class="pill">Encrypted local vault with opaque handles</span>
        <h1>AgentPass</h1>
        <p>Humans manage secrets here. Agents use handles. Browser and file workflows resolve values only at local execution time.</p>
        <p class="hint">Vault: <code>${escapeHtml(vaultPath)}</code> | Logs: <code>${escapeHtml(logDir)}</code></p>
      </section>

      <section class="grid">
        <article class="panel">
          <h2>Vault Status</h2>
          <div id="status" class="status"></div>
          <div class="actions" style="margin-top: 14px;">
            <button type="button" class="secondary" id="refresh-all">Refresh</button>
            <button type="button" class="danger" id="lock-vault">Lock</button>
          </div>
        </article>

        <article class="panel">
          <h2>Setup Or Unlock</h2>
          <input id="passphrase" type="password" autocomplete="current-password" placeholder="Vault passphrase" />
          <div class="actions">
            <button type="button" id="init-vault">Initialize</button>
            <button type="button" class="secondary" id="unlock-vault">Unlock</button>
          </div>
        </article>
      </section>

      <section class="grid">
        <article class="panel">
          <h2>Add Login</h2>
          <input id="login-key" placeholder="Key: costco.com" />
          <input id="login-label" placeholder="Label" />
          <input id="login-site" placeholder="Site URL" />
          <input id="login-username" placeholder="Username" />
          <input id="login-email" placeholder="Email" />
          <input id="login-password" type="password" placeholder="Password" />
          <input id="login-totp" placeholder="TOTP seed or otpauth URI" />
          <input id="login-tags" placeholder="Tags: shopping,household" />
          <textarea id="login-notes" placeholder="Notes"></textarea>
          <button type="button" id="add-login">Save Login</button>
        </article>

        <article class="panel">
          <h2>Add Card</h2>
          <input id="card-key" placeholder="Key: chase-visa" />
          <input id="card-label" placeholder="Label" />
          <input id="card-issuer" placeholder="Issuer or site" />
          <input id="card-name" placeholder="Cardholder name" />
          <input id="card-number" placeholder="Card number" />
          <div class="entry-grid">
            <input id="card-month" placeholder="Expiry month" />
            <input id="card-year" placeholder="Expiry year" />
          </div>
          <div class="entry-grid">
            <input id="card-cvv" placeholder="CVV" />
            <input id="card-postal" placeholder="Billing ZIP or postal code" />
          </div>
          <input id="card-tags" placeholder="Tags: finance,personal" />
          <textarea id="card-notes" placeholder="Notes"></textarea>
          <button type="button" id="add-card">Save Card</button>
        </article>
      </section>

      <section class="panel" style="margin-bottom: 18px;">
        <h2>Entries</h2>
        <div id="entries" class="entry-list"></div>
      </section>

      <section class="panel">
        <h2>Audit Log</h2>
        <div id="logs" class="log-list"></div>
      </section>
    </main>

    <script>
      const actorHeaders = {
        "x-agentpass-actor-type": "human",
        "x-agentpass-actor-id": "human-ui"
      };

      function escapeHtml(value) {
        return String(value ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
      }

      async function api(path, options = {}) {
        const response = await fetch(path, {
          headers: {
            "content-type": "application/json",
            ...actorHeaders,
            ...(options.headers || {})
          },
          ...options
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload.error || "Request failed");
        }

        return payload;
      }

      function modeCheckbox(field, mode, label) {
        return '<label class="mode-pill"><input type="checkbox" data-mode="' + mode + '" ' + (field.policy.allowedUseModes.includes(mode) ? "checked" : "") + ' /> ' + label + '</label>';
      }

      function renderStatus(status) {
        const statusRoot = document.querySelector("#status");
        statusRoot.innerHTML = [
          '<div><strong>Initialized:</strong> ' + (status.initialized ? "yes" : "no") + '</div>',
          '<div><strong>Locked:</strong> ' + (status.locked ? "yes" : "no") + '</div>',
          '<div><strong>Entries:</strong> ' + status.entryCount + '</div>',
          '<div><strong>Vault:</strong> <code>' + escapeHtml(status.vaultPath) + '</code></div>',
          '<div><strong>Logs:</strong> <code>' + escapeHtml(status.logDir) + '</code></div>'
        ].join("");
      }

      function renderLogs(events) {
        const root = document.querySelector("#logs");

        if (!events.length) {
          root.innerHTML = '<p class="hint">No logs yet.</p>';
          return;
        }

        root.innerHTML = events.map((event) => {
          return '<div class="log-item">' +
            '<strong>' + escapeHtml(event.action) + '</strong> <small>(' + escapeHtml(event.result) + ')</small><br />' +
            '<small>' + escapeHtml(event.timestamp) + ' | ' + escapeHtml(event.actor_type) + ':' + escapeHtml(event.actor_id) + '</small><br />' +
            '<small>' + escapeHtml(event.handle || event.target_id || "") + '</small>' +
            (event.origin ? '<div><small>origin: ' + escapeHtml(event.origin) + '</small></div>' : '') +
            (event.file_path ? '<div><small>file: ' + escapeHtml(event.file_path) + '</small></div>' : '') +
            (event.message ? '<div><small>' + escapeHtml(event.message) + '</small></div>' : '') +
          '</div>';
        }).join("");
      }

      function renderEntries(entries) {
        const root = document.querySelector("#entries");

        if (!entries.length) {
          root.innerHTML = '<p class="hint">No entries yet.</p>';
          return;
        }

        root.innerHTML = entries.map((entry) => {
          const presentFieldNames = new Set(entry.fields.map((field) => field.fieldName));
          const missingFields = (entry.expectedFieldNames || []).filter((fieldName) => !presentFieldNames.has(fieldName));
          const scopeValue = entry.entryType === "login" ? entry.site : entry.issuer;
          const scopeLabel = entry.entryType === "login" ? "Site" : "Issuer";
          const fieldMarkup = entry.fields.map((field) => {
            return '<div class="field-row" data-field-id="' + escapeHtml(field.id) + '" data-handle="' + escapeHtml(field.handle) + '">' +
              '<div class="entry-grid">' +
                '<div><strong>' + escapeHtml(field.fieldName) + '</strong><br /><small>' + escapeHtml(field.previewMasked) + '</small><br /><code>' + escapeHtml(field.handle) + '</code></div>' +
                '<div><small>Updated</small><br />' + escapeHtml(field.updatedAt) + '</div>' +
                '<div><small>Last Used</small><br />' + escapeHtml(field.lastUsedAt || "never") + '</div>' +
              '</div>' +
              '<input data-role="field-value" placeholder="New value (leave blank to keep current)" />' +
              '<label><input type="checkbox" data-role="field-disabled" ' + (field.policy.disabled ? "checked" : "") + ' /> Disabled</label>' +
              '<input data-role="field-origins" placeholder="Allowed origins, comma separated" value="' + escapeHtml((field.policy.allowedOrigins || []).join(", ")) + '" />' +
              '<div class="mode-list">' +
                modeCheckbox(field, "browser_fill", "browser fill") +
                modeCheckbox(field, "file_render", "file render") +
                modeCheckbox(field, "totp_generate", "totp generate") +
              '</div>' +
              '<div class="actions">' +
                '<button type="button" class="secondary" data-action="copy-handle">Copy Handle</button>' +
                (field.fieldName === "totp_seed" ? '<button type="button" class="secondary" data-action="generate-totp">Generate TOTP</button>' : '') +
                '<button type="button" data-action="save-field">Save Field</button>' +
                '<button type="button" class="danger" data-action="remove-field">Remove Field</button>' +
              '</div>' +
            '</div>';
          }).join("");

          const missingMarkup = missingFields.length
            ? '<div class="field-row" data-entry-add-field="' + escapeHtml(entry.id) + '">' +
                '<strong>Add Missing Field</strong>' +
                '<div class="entry-grid">' +
                  '<select data-role="missing-name">' + missingFields.map((fieldName) => '<option value="' + escapeHtml(fieldName) + '">' + escapeHtml(fieldName) + '</option>').join("") + '</select>' +
                  '<input data-role="missing-value" placeholder="Value for new field" />' +
                '</div>' +
                '<button type="button" data-action="add-field">Add Field</button>' +
              '</div>'
            : "";

          return '<article class="entry-card" data-entry-id="' + escapeHtml(entry.id) + '" data-entry-type="' + escapeHtml(entry.entryType) + '">' +
            '<div class="entry-grid">' +
              '<input data-role="entry-label" value="' + escapeHtml(entry.label) + '" placeholder="Label" />' +
              '<input data-role="entry-scope" value="' + escapeHtml(scopeValue || "") + '" placeholder="' + scopeLabel + '" />' +
              '<input data-role="entry-tags" value="' + escapeHtml((entry.tags || []).join(", ")) + '" placeholder="Tags" />' +
            '</div>' +
            '<textarea data-role="entry-notes" placeholder="Notes">' + escapeHtml(entry.notes || "") + '</textarea>' +
            '<div><small>' + escapeHtml(entry.entryType) + ' | key: ' + escapeHtml(entry.key) + '</small></div>' +
            '<div class="actions" style="margin: 12px 0 8px;">' +
              '<button type="button" data-action="save-entry">Save Entry</button>' +
              '<button type="button" class="danger" data-action="remove-entry">Remove Entry</button>' +
            '</div>' +
            fieldMarkup +
            missingMarkup +
          '</article>';
        }).join("");
      }

      async function refreshAll() {
        const status = await api("/api/status", {
          headers: actorHeaders
        });
        renderStatus(status);

        try {
          const entries = await api("/api/entries", {
            headers: actorHeaders
          });
          renderEntries(entries);
        } catch (error) {
          document.querySelector("#entries").innerHTML = '<p class="hint">' + escapeHtml(error.message) + '</p>';
        }

        const logs = await api("/api/logs?limit=50", {
          headers: actorHeaders
        }).catch(() => []);
        renderLogs(logs);
      }

      async function createLogin() {
        await api("/api/entries/login", {
          method: "POST",
          body: JSON.stringify({
            key: document.querySelector("#login-key").value,
            label: document.querySelector("#login-label").value,
            site: document.querySelector("#login-site").value,
            notes: document.querySelector("#login-notes").value,
            tags: document.querySelector("#login-tags").value,
            fieldValues: {
              username: document.querySelector("#login-username").value,
              email: document.querySelector("#login-email").value,
              password: document.querySelector("#login-password").value,
              totp_seed: document.querySelector("#login-totp").value
            }
          })
        });
        await refreshAll();
      }

      async function createCard() {
        await api("/api/entries/card", {
          method: "POST",
          body: JSON.stringify({
            key: document.querySelector("#card-key").value,
            label: document.querySelector("#card-label").value,
            issuer: document.querySelector("#card-issuer").value,
            notes: document.querySelector("#card-notes").value,
            tags: document.querySelector("#card-tags").value,
            fieldValues: {
              cardholder_name: document.querySelector("#card-name").value,
              card_number: document.querySelector("#card-number").value,
              expiry_month: document.querySelector("#card-month").value,
              expiry_year: document.querySelector("#card-year").value,
              cvv: document.querySelector("#card-cvv").value,
              billing_postal_code: document.querySelector("#card-postal").value
            }
          })
        });
        await refreshAll();
      }

      function fieldPayloadFromRow(row) {
        const value = row.querySelector('[data-role="field-value"]').value;
        const disabled = row.querySelector('[data-role="field-disabled"]').checked;
        const allowedOrigins = row.querySelector('[data-role="field-origins"]').value;
        const allowedUseModes = Array.from(row.querySelectorAll("[data-mode]"))
          .filter((input) => input.checked)
          .map((input) => input.dataset.mode);
        const payload = {
          policy: {
            disabled,
            allowedOrigins,
            allowedUseModes
          }
        };

        if (value.trim()) {
          payload.value = value;
        }

        return payload;
      }

      document.querySelector("#refresh-all").addEventListener("click", refreshAll);
      document.querySelector("#lock-vault").addEventListener("click", async () => {
        await api("/api/lock", {
          method: "POST"
        });
        await refreshAll();
      });
      document.querySelector("#init-vault").addEventListener("click", async () => {
        await api("/api/init", {
          method: "POST",
          body: JSON.stringify({
            passphrase: document.querySelector("#passphrase").value
          })
        });
        document.querySelector("#passphrase").value = "";
        await refreshAll();
      });
      document.querySelector("#unlock-vault").addEventListener("click", async () => {
        await api("/api/unlock", {
          method: "POST",
          body: JSON.stringify({
            passphrase: document.querySelector("#passphrase").value
          })
        });
        document.querySelector("#passphrase").value = "";
        await refreshAll();
      });
      document.querySelector("#add-login").addEventListener("click", createLogin);
      document.querySelector("#add-card").addEventListener("click", createCard);

      document.querySelector("#entries").addEventListener("click", async (event) => {
        const target = event.target.closest("[data-action]");

        if (!target) {
          return;
        }

        const action = target.dataset.action;
        const entryCard = target.closest("[data-entry-id]");
        const fieldRow = target.closest("[data-field-id]");
        const addFieldRow = target.closest("[data-entry-add-field]");

        if (action === "copy-handle" && fieldRow) {
          await navigator.clipboard.writeText(fieldRow.dataset.handle);
          target.textContent = "Copied";
          setTimeout(() => {
            target.textContent = "Copy Handle";
          }, 1000);
          return;
        }

        if (action === "generate-totp" && fieldRow) {
          const payload = await api("/api/totp", {
            method: "POST",
            body: JSON.stringify({
              handle: fieldRow.dataset.handle
            })
          });
          alert("Current TOTP: " + payload.code);
          await refreshAll();
          return;
        }

        if (action === "save-entry" && entryCard) {
          await api("/api/entries/" + encodeURIComponent(entryCard.dataset.entryId), {
            method: "PATCH",
            body: JSON.stringify({
              label: entryCard.querySelector('[data-role="entry-label"]').value,
              notes: entryCard.querySelector('[data-role="entry-notes"]').value,
              tags: entryCard.querySelector('[data-role="entry-tags"]').value,
              site: entryCard.dataset.entryType === "login" ? entryCard.querySelector('[data-role="entry-scope"]').value : undefined,
              issuer: entryCard.dataset.entryType === "card" ? entryCard.querySelector('[data-role="entry-scope"]').value : undefined
            })
          });
          await refreshAll();
          return;
        }

        if (action === "remove-entry" && entryCard) {
          await api("/api/entries/" + encodeURIComponent(entryCard.dataset.entryId), {
            method: "DELETE"
          });
          await refreshAll();
          return;
        }

        if (action === "save-field" && fieldRow) {
          await api("/api/fields/" + encodeURIComponent(fieldRow.dataset.fieldId), {
            method: "PATCH",
            body: JSON.stringify(fieldPayloadFromRow(fieldRow))
          });
          await refreshAll();
          return;
        }

        if (action === "remove-field" && fieldRow) {
          await api("/api/fields/" + encodeURIComponent(fieldRow.dataset.fieldId), {
            method: "DELETE"
          });
          await refreshAll();
          return;
        }

        if (action === "add-field" && addFieldRow) {
          await api("/api/entries/" + encodeURIComponent(addFieldRow.dataset.entryAddField) + "/fields", {
            method: "POST",
            body: JSON.stringify({
              fieldName: addFieldRow.querySelector('[data-role="missing-name"]').value,
              value: addFieldRow.querySelector('[data-role="missing-value"]').value
            })
          });
          await refreshAll();
        }
      });

      refreshAll().catch((error) => {
        document.querySelector("#status").innerHTML = '<div class="hint">' + escapeHtml(error.message) + '</div>';
      });
    </script>
  </body>
</html>`;
}
