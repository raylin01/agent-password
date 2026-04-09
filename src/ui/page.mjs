function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderPage({ vaultPath, logDir }) {
  const configJson = JSON.stringify({ vaultPath, logDir }).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>AgentPass</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --sidebar-w:200px;
  --bnav-h:56px;
  --sb-bg:#17171a;
  --sb-border:#2a2a2e;
  --sb-text:#8e8e93;
  --sb-text-hi:#f5f5f7;
  --sb-hover:#222226;
  --sb-active:#2c2c30;
  --bg:#f2f2f7;
  --surface:#fff;
  --text:#1d1d1f;
  --text2:#6e6e73;
  --text3:#aeaeb2;
  --border:#d1d1d6;
  --border-lt:#e5e5ea;
  --accent:#0a84ff;
  --accent-hover:#0070e0;
  --accent-bg:#e8f2ff;
  --green:#30d158;
  --green-bg:#e8faf0;
  --red:#ff453a;
  --red-bg:#fff0ef;
  --amber:#ff9f0a;
  --amber-bg:#fff8eb;
  --r:6px;
  --r-sm:4px;
  --r-lg:10px;
  --font:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  --mono:ui-monospace,"SF Mono","Cascadia Code",Menlo,Consolas,monospace;
  --ease:150ms ease;
}
html{height:100%}
body{font-family:var(--font);font-size:14px;line-height:1.5;color:var(--text);background:var(--bg);height:100%;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
button{font:inherit;cursor:pointer;border:0;background:none}
input,select,textarea{font:inherit;color:var(--text)}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}

/* Lock Screen */
.lock-overlay{position:fixed;inset:0;z-index:500;background:#000;display:flex;align-items:center;justify-content:center}
.lock-card{width:360px;max-width:calc(100vw - 32px);background:#1c1c1e;border-radius:16px;padding:40px 32px;text-align:center;color:#f5f5f7}
.lock-logo{display:flex;align-items:center;justify-content:center;margin:0 auto 16px;width:56px;height:56px;border-radius:14px;background:rgba(255,255,255,.08)}
.lock-logo svg{width:28px;height:28px;color:#f5f5f7}
.lock-card h1{font-size:22px;font-weight:600;letter-spacing:-.02em;margin-bottom:4px}
.lock-card .lock-sub{font-size:13px;color:#98989d;margin-bottom:24px}
.lock-input{width:100%;padding:10px 14px;border-radius:8px;border:1px solid #3a3a3c;background:#2c2c2e;color:#f5f5f7;font-size:15px;margin-bottom:12px}
.lock-input::placeholder{color:#636366}
.lock-input:focus{border-color:var(--accent);outline:none}
.lock-btns{display:flex;flex-direction:column;gap:8px}
.lock-err{color:var(--red);font-size:12px;margin-top:8px;min-height:18px}
.lock-status{color:#636366;font-size:11px;margin-top:12px}

/* Buttons */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:8px 16px;border-radius:var(--r);font-size:13px;font-weight:500;transition:background var(--ease),opacity var(--ease);white-space:nowrap}
.btn-primary{background:var(--accent);color:#fff}
.btn-primary:hover{background:var(--accent-hover)}
.btn-secondary{background:var(--border-lt);color:var(--text)}
.btn-secondary:hover{background:var(--border)}
.btn-danger{background:var(--red);color:#fff}
.btn-danger:hover{background:#e0392f}
.btn-ghost{background:transparent;color:#98989d;border:1px solid #3a3a3c}
.btn-ghost:hover{background:rgba(255,255,255,.06)}
.btn-sm{padding:5px 10px;font-size:12px}
.btn-icon{padding:6px;border-radius:var(--r-sm)}
.btn-icon:hover{background:var(--border-lt)}
.btn svg{width:14px;height:14px}

/* Sidebar */
.sidebar{position:fixed;top:0;left:0;bottom:0;width:var(--sidebar-w);background:var(--sb-bg);border-right:1px solid var(--sb-border);display:flex;flex-direction:column;z-index:200;overflow-y:auto}
.sb-logo{padding:20px 16px 24px;display:flex;align-items:center;gap:10px;color:var(--sb-text-hi);font-size:15px;font-weight:600;letter-spacing:-.02em}
.sb-logo svg{width:22px;height:22px;flex-shrink:0}
.sb-nav{flex:1;padding:0 8px}
.nav-item{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:var(--r);color:var(--sb-text);font-size:13px;font-weight:500;margin-bottom:2px;transition:background var(--ease),color var(--ease)}
.nav-item:hover{background:var(--sb-hover);color:var(--sb-text-hi)}
.nav-item.active{background:var(--sb-active);color:var(--sb-text-hi)}
.nav-item svg{width:16px;height:16px;flex-shrink:0;opacity:.7}
.nav-item.active svg{opacity:1}
.nav-sep{height:1px;background:var(--sb-border);margin:8px 10px}
.sb-footer{padding:12px 16px;border-top:1px solid var(--sb-border)}
.sb-status{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--sb-text);margin-bottom:8px}
.status-dot{width:7px;height:7px;border-radius:50%;background:var(--green);flex-shrink:0}
.status-dot.locked{background:var(--red)}
.sb-lock-btn{width:100%;padding:6px;border-radius:var(--r-sm);font-size:12px;color:var(--sb-text);background:var(--sb-hover);text-align:center;transition:background var(--ease)}
.sb-lock-btn:hover{background:var(--sb-active);color:var(--sb-text-hi)}

/* Bottom Nav */
.bnav{display:none;position:fixed;bottom:0;left:0;right:0;height:var(--bnav-h);background:var(--surface);border-top:1px solid var(--border);z-index:200;justify-content:space-around;align-items:center;padding-bottom:env(safe-area-inset-bottom,0)}
.bnav-item{display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 12px;border-radius:var(--r);color:var(--text3);font-size:10px;font-weight:500;transition:color var(--ease)}
.bnav-item svg{width:20px;height:20px}
.bnav-item.active{color:var(--accent)}

/* Content */
.content{margin-left:var(--sidebar-w);min-height:100vh}
.page-wrap{max-width:880px;margin:0 auto;padding:24px 32px 48px}

/* Page header */
.pg-hdr{display:flex;align-items:center;gap:12px;margin-bottom:20px;min-height:36px}
.pg-hdr h1{font-size:20px;font-weight:600;letter-spacing:-.02em}
.pg-hdr .spacer{flex:1}
.pg-hdr .pg-count{font-size:12px;color:var(--text2);background:var(--border-lt);padding:2px 8px;border-radius:99px}

/* Search + filters */
.search-row{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
.search-box{flex:1;min-width:180px;position:relative}
.search-box svg{position:absolute;left:10px;top:50%;transform:translateY(-50%);width:15px;height:15px;color:var(--text3);pointer-events:none}
.search-box input{width:100%;padding:7px 10px 7px 32px;border:1px solid var(--border);border-radius:var(--r);font-size:13px;background:var(--surface);transition:border-color var(--ease)}
.search-box input:focus{border-color:var(--accent);outline:none}
.filter-pills{display:flex;gap:2px;background:var(--border-lt);border-radius:var(--r);padding:2px}
.fpill{padding:5px 12px;border-radius:var(--r-sm);font-size:12px;font-weight:500;color:var(--text2);transition:background var(--ease),color var(--ease)}
.fpill:hover{color:var(--text)}
.fpill.active{background:var(--surface);color:var(--text);box-shadow:0 1px 2px rgba(0,0,0,.06)}

/* Vault list */
.vault-list{border:1px solid var(--border);border-radius:var(--r-lg);background:var(--surface);overflow:hidden}
.vault-empty{padding:48px 24px;text-align:center;color:var(--text3);font-size:13px}
.entry-row{display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--border-lt);transition:background var(--ease);cursor:pointer}
.entry-row:last-child{border-bottom:0}
.entry-row:hover{background:var(--bg)}
.e-icon{width:32px;height:32px;border-radius:var(--r);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:13px;font-weight:600}
.e-icon.login{background:#e8f2ff;color:var(--accent)}
.e-icon.card{background:#f3e8ff;color:#8b5cf6}
.e-icon svg{width:16px;height:16px}
.e-body{flex:1;min-width:0}
.e-label{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.e-meta{font-size:11px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}
.e-meta span{margin-right:8px}
.e-meta code{font-family:var(--mono);font-size:10px;background:var(--border-lt);padding:1px 5px;border-radius:3px}
.e-badges{display:flex;gap:4px;flex-shrink:0}
.e-badge{font-size:10px;font-weight:500;padding:2px 6px;border-radius:99px;background:var(--border-lt);color:var(--text2)}
.e-arrow{color:var(--text3);flex-shrink:0}
.e-arrow svg{width:14px;height:14px}

/* Entry detail */
.back-link{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--text2);margin-bottom:16px;padding:4px 0;transition:color var(--ease)}
.back-link:hover{color:var(--text)}
.back-link svg{width:14px;height:14px}
.detail-hdr{display:flex;align-items:flex-start;gap:16px;margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid var(--border-lt)}
.detail-icon{width:44px;height:44px;border-radius:var(--r-lg);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:600;flex-shrink:0}
.detail-icon.login{background:#e8f2ff;color:var(--accent)}
.detail-icon.card{background:#f3e8ff;color:#8b5cf6}
.detail-icon svg{width:20px;height:20px}
.detail-info{flex:1;min-width:0}
.detail-info h2{font-size:18px;font-weight:600;letter-spacing:-.02em;margin-bottom:2px}
.detail-info .detail-key{font-size:12px;color:var(--text2);font-family:var(--mono)}
.detail-actions{display:flex;gap:6px;flex-shrink:0}
.detail-type-badge{display:inline-block;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;padding:2px 7px;border-radius:99px;margin-bottom:6px}
.detail-type-badge.login{background:var(--accent-bg);color:var(--accent)}
.detail-type-badge.card{background:#f3e8ff;color:#8b5cf6}

/* Detail metadata form */
.meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px}
.meta-field{display:flex;flex-direction:column;gap:4px}
.meta-field.full{grid-column:1/-1}
.meta-field label{font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.04em}
.meta-field input,.meta-field textarea{padding:7px 10px;border:1px solid var(--border);border-radius:var(--r-sm);font-size:13px;background:var(--surface);transition:border-color var(--ease)}
.meta-field input:focus,.meta-field textarea:focus{border-color:var(--accent);outline:none}
.meta-field textarea{min-height:60px;resize:vertical}
.meta-actions{display:flex;gap:8px;margin-bottom:28px}

/* Fields section */
.fields-hdr{display:flex;align-items:center;gap:8px;margin-bottom:12px}
.fields-hdr h3{font-size:14px;font-weight:600}
.fields-hdr .fields-count{font-size:11px;color:var(--text2)}
.field-list{border:1px solid var(--border);border-radius:var(--r-lg);background:var(--surface);overflow:hidden}
.field-item{border-bottom:1px solid var(--border-lt)}
.field-item:last-child{border-bottom:0}
.field-summary{display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;transition:background var(--ease)}
.field-summary:hover{background:var(--bg)}
.field-name{font-size:13px;font-weight:600;width:120px;flex-shrink:0}
.field-preview{font-size:12px;color:var(--text2);font-family:var(--mono);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.field-handle{font-size:10px;color:var(--text3);font-family:var(--mono);background:var(--border-lt);padding:2px 6px;border-radius:3px;flex-shrink:0;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.field-acts{display:flex;gap:2px;flex-shrink:0}
.field-chevron{color:var(--text3);transition:transform var(--ease);flex-shrink:0}
.field-chevron svg{width:14px;height:14px}
.field-chevron.open{transform:rotate(90deg)}
.field-detail{display:none;padding:12px 14px 16px;background:var(--bg);border-top:1px solid var(--border-lt)}
.field-detail.open{display:block}
.fd-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}
.fd-label{font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px}
.fd-modes{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
.fd-mode{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border:1px solid var(--border);border-radius:99px;font-size:12px;color:var(--text2);background:var(--surface);cursor:pointer;transition:border-color var(--ease),background var(--ease)}
.fd-mode:has(input:checked){border-color:var(--accent);background:var(--accent-bg);color:var(--accent)}
.fd-mode input{display:none}
.fd-actions{display:flex;gap:8px;justify-content:space-between;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)}
.totp-display{display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--green-bg);border-radius:var(--r);margin-top:8px}
.totp-code{font-family:var(--mono);font-size:22px;font-weight:700;letter-spacing:.12em;color:#059669}

/* Add missing field */
.add-field-row{padding:14px;border-top:1px solid var(--border);background:var(--bg)}
.add-field-row h4{font-size:12px;font-weight:600;color:var(--text2);margin-bottom:8px}
.adf-form{display:flex;gap:8px;flex-wrap:wrap}
.adf-form select,.adf-form input{padding:6px 10px;border:1px solid var(--border);border-radius:var(--r-sm);font-size:13px;background:var(--surface)}
.adf-form select{width:auto}
.adf-form input{flex:1;min-width:120px}

/* Add entry page */
.add-tabs{display:flex;gap:0;margin-bottom:20px;border-bottom:2px solid var(--border-lt)}
.add-tab{padding:10px 20px;font-size:13px;font-weight:600;color:var(--text2);border-bottom:2px solid transparent;margin-bottom:-2px;transition:color var(--ease),border-color var(--ease)}
.add-tab:hover{color:var(--text)}
.add-tab.active{color:var(--accent);border-bottom-color:var(--accent)}
.add-form{max-width:520px}
.add-form .meta-field{margin-bottom:4px}
.add-form .form-sep{height:1px;background:var(--border-lt);margin:16px 0}

/* Logs page */
.log-table{border:1px solid var(--border);border-radius:var(--r-lg);background:var(--surface);overflow:auto}
.log-table table{width:100%;border-collapse:collapse;font-size:12px}
.log-table th{text-align:left;padding:8px 12px;font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid var(--border);background:var(--bg);position:sticky;top:0}
.log-table td{padding:7px 12px;border-bottom:1px solid var(--border-lt);vertical-align:top;white-space:nowrap}
.log-table tr:last-child td{border-bottom:0}
.log-table tr:hover td{background:var(--bg)}
.log-result{display:inline-block;font-size:10px;font-weight:600;padding:1px 6px;border-radius:99px}
.log-result.success{background:var(--green-bg);color:#059669}
.log-result.error,.log-result.denied{background:var(--red-bg);color:var(--red)}
.log-action-cell{max-width:160px;overflow:hidden;text-overflow:ellipsis}
.log-detail{font-size:11px;color:var(--text2);max-width:220px;overflow:hidden;text-overflow:ellipsis}

/* Settings page */
.settings-section{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);margin-bottom:16px;overflow:hidden}
.settings-section h3{font-size:13px;font-weight:600;padding:14px 16px;border-bottom:1px solid var(--border-lt);background:var(--bg)}
.settings-row{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--border-lt);font-size:13px}
.settings-row:last-child{border-bottom:0}
.settings-label{color:var(--text2);font-size:12px;font-weight:500}
.settings-val{font-family:var(--mono);font-size:12px;color:var(--text);text-align:right;max-width:400px;overflow:hidden;text-overflow:ellipsis;word-break:break-all}
.settings-actions{padding:16px;display:flex;gap:8px}

/* Toast */
.toast{position:fixed;top:16px;right:16px;z-index:600;padding:10px 16px;border-radius:var(--r);font-size:13px;font-weight:500;color:#fff;transform:translateY(-8px);opacity:0;transition:transform 200ms ease,opacity 200ms ease;pointer-events:none}
.toast.show{transform:translateY(0);opacity:1;pointer-events:auto}
.toast.success{background:#059669}
.toast.error{background:var(--red)}
.toast.info{background:#1d1d1f}

/* Responsive */
@media(max-width:767px){
  .sidebar{display:none}
  .bnav{display:flex}
  .content{margin-left:0}
  .page-wrap{padding:16px 16px calc(var(--bnav-h) + 24px)}
  .pg-hdr h1{font-size:18px}
  .meta-grid{grid-template-columns:1fr}
  .field-name{width:80px}
  .field-handle{display:none}
  .fd-row{grid-template-columns:1fr}
  .search-row{flex-direction:column}
  .filter-pills{align-self:flex-start}
  .entry-row{padding:10px 12px;gap:10px}
  .e-badges{display:none}
  .detail-hdr{flex-direction:column;gap:12px}
  .detail-actions{align-self:flex-start}
  .log-table{font-size:11px}
  .log-table th,.log-table td{padding:6px 8px}
  .lock-card{padding:32px 20px}
}
@media(max-width:480px){
  .field-summary{flex-wrap:wrap;gap:6px}
  .field-name{width:100%;order:1}
  .field-preview{order:3;width:100%}
  .field-handle{order:4}
  .field-acts{order:2;margin-left:auto}
  .field-chevron{order:5}
}
</style>
</head>
<body>

<!-- Lock Screen -->
<div id="lock-screen" class="lock-overlay">
  <div class="lock-card">
    <div class="lock-logo">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
    </div>
    <h1>AgentPass</h1>
    <p class="lock-sub">Local encrypted secret vault</p>
    <input type="password" id="passphrase" class="lock-input" placeholder="Vault passphrase" autocomplete="current-password">
    <div class="lock-btns" id="lock-btns"></div>
    <p class="lock-err" id="lock-err"></p>
    <p class="lock-status" id="lock-hint"></p>
  </div>
</div>

<!-- App Shell -->
<div id="app" style="display:none">

  <!-- Sidebar -->
  <nav class="sidebar" id="sidebar">
    <div class="sb-logo">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      AgentPass
    </div>
    <div class="sb-nav" id="sb-nav"></div>
    <div class="sb-footer">
      <div class="sb-status" id="sb-status">
        <span class="status-dot" id="sb-dot"></span>
        <span id="sb-status-text">Checking...</span>
      </div>
      <button class="sb-lock-btn" id="sb-lock">Lock Vault</button>
    </div>
  </nav>

  <!-- Main Content -->
  <main class="content">
    <div class="page-wrap" id="page"></div>
  </main>

  <!-- Bottom Nav (mobile) -->
  <nav class="bnav" id="bnav"></nav>
</div>

<!-- Toast -->
<div id="toast" class="toast"></div>

<script>
(function(){
  "use strict";

  var CONFIG = ${configJson};
  var state = {
    loaded: false,
    status: null,
    entries: [],
    logs: [],
    search: "",
    filter: "all",
    addType: "login",
    expanded: {},
    totp: {},
    editingEntry: false
  };

  var ACTOR = {
    "x-agentpass-actor-type": "human",
    "x-agentpass-actor-id": "human-ui"
  };

  // --- Utilities ---
  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function relTime(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    var now = Date.now();
    var sec = Math.floor((now - d.getTime()) / 1000);
    if (sec < 60) return "just now";
    if (sec < 3600) return Math.floor(sec / 60) + "m ago";
    if (sec < 86400) return Math.floor(sec / 3600) + "h ago";
    if (sec < 2592000) return Math.floor(sec / 86400) + "d ago";
    return d.toLocaleDateString();
  }

  // --- Icons ---
  var I = {
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    cog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.32 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>',
    key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>',
    card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><path d="M1 10h22"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>',
    chevL: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
    chevR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
  };

  // --- API ---
  function api(path, opts) {
    opts = opts || {};
    var headers = Object.assign({ "content-type": "application/json" }, ACTOR, opts.headers || {});
    return fetch(path, Object.assign({}, opts, { headers: headers }))
      .then(function(r) {
        return r.json().catch(function() { return {}; }).then(function(data) {
          if (!r.ok) throw new Error(data.error || "Request failed (" + r.status + ")");
          return data;
        });
      });
  }

  // --- Toast ---
  var toastTimer = null;
  function toast(msg, type) {
    var el = document.getElementById("toast");
    el.textContent = msg;
    el.className = "toast " + (type || "info") + " show";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function() { el.className = "toast"; }, 3000);
  }

  // --- Router ---
  function getRoute() {
    var h = location.hash || "#/vault";
    if (h.indexOf("#/entry/") === 0) return { page: "entry", id: decodeURIComponent(h.slice(8)) };
    if (h === "#/add") return { page: "add" };
    if (h === "#/logs") return { page: "logs" };
    if (h === "#/settings") return { page: "settings" };
    return { page: "vault" };
  }

  // --- Nav rendering ---
  var NAV = [
    { id: "vault", hash: "#/vault", icon: "shield", label: "Vault" },
    { id: "add", hash: "#/add", icon: "plus", label: "Add Entry" },
    { id: "logs", hash: "#/logs", icon: "clock", label: "Audit Log" },
    { id: "settings", hash: "#/settings", icon: "cog", label: "Settings" }
  ];

  function renderNav(activePage) {
    var sbHtml = "";
    var bnHtml = "";
    var activeBase = activePage === "entry" ? "vault" : activePage;
    for (var i = 0; i < NAV.length; i++) {
      var n = NAV[i];
      var ac = n.id === activeBase ? " active" : "";
      sbHtml += '<a href="' + n.hash + '" class="nav-item' + ac + '">' + I[n.icon] + ' ' + esc(n.label) + '</a>';
      bnHtml += '<a href="' + n.hash + '" class="bnav-item' + ac + '">' + I[n.icon] + '<span>' + esc(n.label) + '</span></a>';
    }
    document.getElementById("sb-nav").innerHTML = sbHtml;
    document.getElementById("bnav").innerHTML = bnHtml;
  }

  function updateSidebarStatus() {
    var s = state.status;
    if (!s) return;
    var dot = document.getElementById("sb-dot");
    var txt = document.getElementById("sb-status-text");
    if (s.locked) {
      dot.className = "status-dot locked";
      txt.textContent = "Locked";
    } else {
      dot.className = "status-dot";
      txt.textContent = "Unlocked \u00b7 " + s.entryCount + " entries";
    }
  }

  // --- Lock screen ---
  function showLockScreen() {
    var s = state.status;
    document.getElementById("app").style.display = "none";
    document.getElementById("lock-screen").style.display = "";
    var btns = document.getElementById("lock-btns");
    var hint = document.getElementById("lock-hint");
    if (!s || !s.initialized) {
      btns.innerHTML = '<button class="btn btn-primary" style="width:100%" id="btn-init">Initialize New Vault</button>';
      hint.textContent = "No vault found. Enter a passphrase to create one.";
      document.getElementById("btn-init").onclick = doInit;
    } else {
      btns.innerHTML = '<button class="btn btn-primary" style="width:100%" id="btn-unlock">Unlock</button>';
      hint.textContent = s.entryCount + " entries encrypted at rest.";
      document.getElementById("btn-unlock").onclick = doUnlock;
    }
    document.getElementById("lock-err").textContent = "";
    var pp = document.getElementById("passphrase");
    pp.onkeydown = function(e) {
      if (e.key === "Enter") {
        e.preventDefault();
        if (!s || !s.initialized) doInit();
        else doUnlock();
      }
    };
    setTimeout(function() { pp.focus(); }, 100);
  }

  function hideLockScreen() {
    document.getElementById("lock-screen").style.display = "none";
    document.getElementById("app").style.display = "";
  }

  function doInit() {
    var pp = document.getElementById("passphrase");
    var v = pp.value;
    if (!v) { document.getElementById("lock-err").textContent = "Passphrase is required."; return; }
    if (v.length < 4) { document.getElementById("lock-err").textContent = "Passphrase too short."; return; }
    api("/api/init", { method: "POST", body: JSON.stringify({ passphrase: v }) })
      .then(function() { pp.value = ""; return refresh(); })
      .then(function() { toast("Vault initialized", "success"); render(); })
      .catch(function(e) { document.getElementById("lock-err").textContent = e.message; });
  }

  function doUnlock() {
    var pp = document.getElementById("passphrase");
    var v = pp.value;
    if (!v) { document.getElementById("lock-err").textContent = "Passphrase is required."; return; }
    api("/api/unlock", { method: "POST", body: JSON.stringify({ passphrase: v }) })
      .then(function() { pp.value = ""; return refresh(); })
      .then(function() { toast("Vault unlocked", "success"); render(); })
      .catch(function(e) { document.getElementById("lock-err").textContent = e.message; });
  }

  function doLock() {
    api("/api/lock", { method: "POST" })
      .then(function() { state.entries = []; state.totp = {}; return refresh(); })
      .then(function() { render(); });
  }

  // --- Data fetching ---
  function refresh() {
    return api("/api/status").then(function(s) {
      state.status = s;
      state.loaded = true;
      updateSidebarStatus();
      if (!s.locked && s.initialized) {
        return Promise.all([
          api("/api/entries").then(function(e) { state.entries = e; }).catch(function() { state.entries = []; }),
          api("/api/logs?limit=100").then(function(l) { state.logs = l; }).catch(function() { state.logs = []; })
        ]);
      } else {
        state.entries = [];
        state.logs = [];
      }
    });
  }

  // --- Page renderers ---
  function renderVaultPage() {
    var filtered = state.entries;
    var q = state.search.toLowerCase();
    if (state.filter !== "all") {
      filtered = filtered.filter(function(e) { return e.entryType === state.filter; });
    }
    if (q) {
      filtered = filtered.filter(function(e) {
        return (e.label || "").toLowerCase().indexOf(q) !== -1 ||
               (e.key || "").toLowerCase().indexOf(q) !== -1 ||
               (e.site || "").toLowerCase().indexOf(q) !== -1 ||
               (e.issuer || "").toLowerCase().indexOf(q) !== -1 ||
               (e.tags || []).join(" ").toLowerCase().indexOf(q) !== -1;
      });
    }

    var html = '<div class="pg-hdr"><h1>Vault</h1><span class="spacer"></span>';
    html += '<span class="pg-count">' + state.entries.length + ' entries</span></div>';

    html += '<div class="search-row">';
    html += '<div class="search-box">' + I.search + '<input type="text" id="vault-search" placeholder="Search entries..." value="' + esc(state.search) + '"></div>';
    html += '<div class="filter-pills">';
    html += '<button class="fpill' + (state.filter === "all" ? " active" : "") + '" data-action="filter" data-val="all">All</button>';
    html += '<button class="fpill' + (state.filter === "login" ? " active" : "") + '" data-action="filter" data-val="login">Logins</button>';
    html += '<button class="fpill' + (state.filter === "card" ? " active" : "") + '" data-action="filter" data-val="card">Cards</button>';
    html += '</div></div>';

    html += '<div class="vault-list">';
    if (!filtered.length) {
      html += '<div class="vault-empty">' + (state.entries.length ? "No matching entries" : "No entries yet. Add your first credential.") + '</div>';
    } else {
      for (var i = 0; i < filtered.length; i++) {
        var e = filtered[i];
        var isLogin = e.entryType === "login";
        var scope = isLogin ? e.site : e.issuer;
        html += '<a href="#/entry/' + encodeURIComponent(e.id) + '" class="entry-row">';
        html += '<div class="e-icon ' + esc(e.entryType) + '">' + (isLogin ? I.key : I.card) + '</div>';
        html += '<div class="e-body">';
        html += '<div class="e-label">' + esc(e.label || e.key) + '</div>';
        html += '<div class="e-meta">';
        html += '<code>' + esc(e.key) + '</code>';
        if (scope) html += '<span>' + esc(scope) + '</span>';
        html += '</div></div>';
        html += '<div class="e-badges">';
        html += '<span class="e-badge">' + e.fields.length + ' field' + (e.fields.length !== 1 ? "s" : "") + '</span>';
        if (e.tags && e.tags.length) {
          for (var t = 0; t < Math.min(e.tags.length, 2); t++) {
            html += '<span class="e-badge">' + esc(e.tags[t]) + '</span>';
          }
        }
        html += '</div>';
        html += '<span class="e-arrow">' + I.chevR + '</span>';
        html += '</a>';
      }
    }
    html += '</div>';
    return html;
  }

  function renderEntryPage(entryId) {
    var entry = null;
    for (var i = 0; i < state.entries.length; i++) {
      if (state.entries[i].id === entryId) { entry = state.entries[i]; break; }
    }
    if (!entry) return '<a href="#/vault" class="back-link">' + I.chevL + ' Back to vault</a><p style="color:var(--text2)">Entry not found.</p>';

    var isLogin = entry.entryType === "login";
    var scope = isLogin ? entry.site : entry.issuer;
    var scopeLabel = isLogin ? "Site" : "Issuer";

    var html = '<a href="#/vault" class="back-link">' + I.chevL + ' Vault</a>';

    // Header
    html += '<div class="detail-hdr">';
    html += '<div class="detail-icon ' + esc(entry.entryType) + '">' + (isLogin ? I.key : I.card) + '</div>';
    html += '<div class="detail-info">';
    html += '<span class="detail-type-badge ' + esc(entry.entryType) + '">' + esc(entry.entryType) + '</span>';
    html += '<h2>' + esc(entry.label || entry.key) + '</h2>';
    html += '<span class="detail-key">' + esc(entry.key) + '</span>';
    html += '</div>';
    html += '<div class="detail-actions">';
    html += '<button class="btn btn-danger btn-sm" data-action="remove-entry" data-id="' + esc(entry.id) + '">' + I.trash + ' Delete</button>';
    html += '</div></div>';

    // Metadata
    html += '<div class="meta-grid" data-entry-id="' + esc(entry.id) + '" data-entry-type="' + esc(entry.entryType) + '">';
    html += '<div class="meta-field"><label>Label</label><input data-role="entry-label" value="' + esc(entry.label) + '"></div>';
    html += '<div class="meta-field"><label>' + esc(scopeLabel) + '</label><input data-role="entry-scope" value="' + esc(scope || "") + '"></div>';
    html += '<div class="meta-field"><label>Tags</label><input data-role="entry-tags" value="' + esc((entry.tags || []).join(", ")) + '" placeholder="comma separated"></div>';
    html += '<div class="meta-field full"><label>Notes</label><textarea data-role="entry-notes" placeholder="Optional notes">' + esc(entry.notes || "") + '</textarea></div>';
    html += '</div>';
    html += '<div class="meta-actions">';
    html += '<button class="btn btn-primary btn-sm" data-action="save-entry" data-id="' + esc(entry.id) + '">' + I.check + ' Save Details</button>';
    html += '</div>';

    // Fields
    var presentFieldNames = {};
    for (var f = 0; f < entry.fields.length; f++) presentFieldNames[entry.fields[f].fieldName] = true;
    var missingFields = (entry.expectedFieldNames || []).filter(function(n) { return !presentFieldNames[n]; });

    html += '<div class="fields-hdr"><h3>Fields</h3><span class="fields-count">' + entry.fields.length + ' stored</span></div>';
    html += '<div class="field-list">';

    for (var fi = 0; fi < entry.fields.length; fi++) {
      var field = entry.fields[fi];
      var isExpanded = !!state.expanded[field.id];
      var totpData = state.totp[field.id];

      html += '<div class="field-item" data-field-id="' + esc(field.id) + '" data-handle="' + esc(field.handle) + '">';

      // Summary row
      html += '<div class="field-summary" data-action="toggle-field" data-fid="' + esc(field.id) + '">';
      html += '<span class="field-name">' + esc(field.fieldName) + '</span>';
      html += '<span class="field-preview">' + esc(field.previewMasked) + '</span>';
      html += '<span class="field-handle">' + esc(field.handle) + '</span>';
      html += '<span class="field-acts">';
      html += '<button class="btn-icon" data-action="copy-handle" data-handle="' + esc(field.handle) + '" title="Copy handle">' + I.copy + '</button>';
      if (field.fieldName === "totp_seed") {
        html += '<button class="btn-icon" data-action="gen-totp" data-handle="' + esc(field.handle) + '" data-fid="' + esc(field.id) + '" title="Generate TOTP" style="color:var(--accent)">' + I.lock + '</button>';
      }
      html += '</span>';
      html += '<span class="field-chevron' + (isExpanded ? " open" : "") + '">' + I.chevR + '</span>';
      html += '</div>';

      // TOTP display
      if (totpData) {
        html += '<div class="totp-display">';
        html += '<span class="totp-code">' + esc(totpData.code) + '</span>';
        html += '<button class="btn btn-sm btn-secondary" data-action="copy-totp" data-code="' + esc(totpData.code) + '">' + I.copy + ' Copy</button>';
        html += '</div>';
      }

      // Detail panel
      html += '<div class="field-detail' + (isExpanded ? " open" : "") + '">';
      html += '<div class="fd-row"><div><span class="fd-label">Handle</span><br><code style="font-size:11px;font-family:var(--mono);color:var(--text2)">' + esc(field.handle) + '</code></div>';
      html += '<div><span class="fd-label">Updated</span><br><span style="font-size:12px;color:var(--text2)">' + esc(relTime(field.updatedAt)) + '</span></div></div>';
      html += '<div class="fd-row"><div><span class="fd-label">Last Used</span><br><span style="font-size:12px;color:var(--text2)">' + esc(field.lastUsedAt ? relTime(field.lastUsedAt) : "Never") + '</span></div>';
      html += '<div><span class="fd-label">Created</span><br><span style="font-size:12px;color:var(--text2)">' + esc(relTime(field.createdAt)) + '</span></div></div>';

      // Policy: modes
      html += '<span class="fd-label">Allowed Modes</span>';
      html += '<div class="fd-modes">';
      var modes = [["browser_fill", "Browser Fill"], ["file_render", "File Render"], ["totp_generate", "TOTP Generate"]];
      for (var m = 0; m < modes.length; m++) {
        var checked = field.policy.allowedUseModes.indexOf(modes[m][0]) !== -1;
        html += '<label class="fd-mode"><input type="checkbox" data-mode="' + modes[m][0] + '"' + (checked ? " checked" : "") + '>' + modes[m][1] + '</label>';
      }
      html += '</div>';

      // Policy: disabled + origins
      html += '<div class="fd-row">';
      html += '<div class="meta-field"><label>Allowed Origins</label><input data-role="field-origins" value="' + esc((field.policy.allowedOrigins || []).join(", ")) + '" placeholder="comma separated"></div>';
      html += '<div class="meta-field"><label style="display:flex;align-items:center;gap:6px"><input type="checkbox" data-role="field-disabled"' + (field.policy.disabled ? " checked" : "") + ' style="width:auto;margin:0"> Disabled</label></div>';
      html += '</div>';

      // Update value
      html += '<div class="meta-field"><label>New Value</label><input data-role="field-value" placeholder="Enter new value to update (leave blank to keep)"></div>';

      html += '<div class="fd-actions">';
      html += '<button class="btn btn-primary btn-sm" data-action="save-field" data-fid="' + esc(field.id) + '">' + I.check + ' Save Field</button>';
      html += '<button class="btn btn-danger btn-sm" data-action="remove-field" data-fid="' + esc(field.id) + '">' + I.trash + ' Delete</button>';
      html += '</div>';

      html += '</div>'; // field-detail
      html += '</div>'; // field-item
    }

    // Add missing field
    if (missingFields.length) {
      html += '<div class="add-field-row" data-entry-add="' + esc(entry.id) + '">';
      html += '<h4>Add Missing Field</h4>';
      html += '<div class="adf-form">';
      html += '<select data-role="missing-name">';
      for (var mf = 0; mf < missingFields.length; mf++) {
        html += '<option value="' + esc(missingFields[mf]) + '">' + esc(missingFields[mf]) + '</option>';
      }
      html += '</select>';
      html += '<input data-role="missing-value" placeholder="Value">';
      html += '<button class="btn btn-primary btn-sm" data-action="add-field">' + I.plus + ' Add</button>';
      html += '</div></div>';
    }

    html += '</div>'; // field-list
    return html;
  }

  function renderAddPage() {
    var isLogin = state.addType === "login";
    var html = '<div class="pg-hdr"><h1>Add Entry</h1></div>';

    html += '<div class="add-tabs">';
    html += '<button class="add-tab' + (isLogin ? " active" : "") + '" data-action="add-type" data-val="login">Login</button>';
    html += '<button class="add-tab' + (!isLogin ? " active" : "") + '" data-action="add-type" data-val="card">Card</button>';
    html += '</div>';

    html += '<div class="add-form">';
    if (isLogin) {
      html += '<div class="meta-field"><label>Key *</label><input id="add-key" placeholder="e.g. costco.com"></div>';
      html += '<div class="meta-field"><label>Label</label><input id="add-label" placeholder="e.g. Costco"></div>';
      html += '<div class="meta-field"><label>Site URL</label><input id="add-site" placeholder="https://www.costco.com"></div>';
      html += '<div class="form-sep"></div>';
      html += '<div class="meta-field"><label>Username</label><input id="add-username" placeholder="username"></div>';
      html += '<div class="meta-field"><label>Email</label><input id="add-email" placeholder="email@example.com"></div>';
      html += '<div class="meta-field"><label>Password</label><input id="add-password" type="password" placeholder="password"></div>';
      html += '<div class="meta-field"><label>TOTP Seed</label><input id="add-totp" placeholder="TOTP seed or otpauth:// URI"></div>';
    } else {
      html += '<div class="meta-field"><label>Key *</label><input id="add-key" placeholder="e.g. chase-visa"></div>';
      html += '<div class="meta-field"><label>Label</label><input id="add-label" placeholder="e.g. Chase Visa"></div>';
      html += '<div class="meta-field"><label>Issuer</label><input id="add-issuer" placeholder="e.g. Chase"></div>';
      html += '<div class="form-sep"></div>';
      html += '<div class="meta-field"><label>Cardholder Name</label><input id="add-name" placeholder="Full name on card"></div>';
      html += '<div class="meta-field"><label>Card Number</label><input id="add-number" placeholder="Card number"></div>';
      html += '<div class="meta-grid" style="margin-bottom:0">';
      html += '<div class="meta-field"><label>Expiry Month</label><input id="add-month" placeholder="MM"></div>';
      html += '<div class="meta-field"><label>Expiry Year</label><input id="add-year" placeholder="YYYY"></div>';
      html += '</div>';
      html += '<div class="meta-grid" style="margin-bottom:0">';
      html += '<div class="meta-field"><label>CVV</label><input id="add-cvv" placeholder="CVV" type="password"></div>';
      html += '<div class="meta-field"><label>Billing ZIP</label><input id="add-postal" placeholder="ZIP / postal code"></div>';
      html += '</div>';
    }
    html += '<div class="form-sep"></div>';
    html += '<div class="meta-field"><label>Tags</label><input id="add-tags" placeholder="comma separated tags"></div>';
    html += '<div class="meta-field"><label>Notes</label><textarea id="add-notes" placeholder="Optional notes"></textarea></div>';
    html += '<div style="margin-top:16px;display:flex;gap:8px">';
    html += '<button class="btn btn-primary" data-action="submit-entry">' + I.check + ' Save ' + (isLogin ? "Login" : "Card") + '</button>';
    html += '<a href="#/vault" class="btn btn-secondary">Cancel</a>';
    html += '</div></div>';
    return html;
  }

  function renderLogsPage() {
    var html = '<div class="pg-hdr"><h1>Audit Log</h1><span class="spacer"></span>';
    html += '<button class="btn btn-secondary btn-sm" data-action="refresh-logs">' + I.clock + ' Refresh</button></div>';

    if (!state.logs.length) {
      html += '<div class="vault-list"><div class="vault-empty">No audit log events yet.</div></div>';
      return html;
    }

    html += '<div class="log-table"><table>';
    html += '<thead><tr><th>Time</th><th>Action</th><th>Result</th><th>Actor</th><th>Target</th><th>Details</th></tr></thead>';
    html += '<tbody>';
    for (var i = 0; i < state.logs.length; i++) {
      var ev = state.logs[i];
      var resultClass = ev.result === "success" ? "success" : "error";
      html += '<tr>';
      html += '<td style="font-size:11px;color:var(--text2);white-space:nowrap">' + esc(relTime(ev.timestamp)) + '</td>';
      html += '<td class="log-action-cell"><strong>' + esc(ev.action) + '</strong></td>';
      html += '<td><span class="log-result ' + resultClass + '">' + esc(ev.result) + '</span></td>';
      html += '<td style="font-size:11px;color:var(--text2)">' + esc(ev.actor_type) + ':' + esc(ev.actor_id) + '</td>';
      html += '<td style="font-family:var(--mono);font-size:11px">' + esc(ev.handle || ev.target_id || "—") + '</td>';
      html += '<td class="log-detail">';
      if (ev.origin) html += 'origin: ' + esc(ev.origin) + ' ';
      if (ev.file_path) html += 'file: ' + esc(ev.file_path) + ' ';
      if (ev.message) html += esc(ev.message);
      if (!ev.origin && !ev.file_path && !ev.message) html += '—';
      html += '</td></tr>';
    }
    html += '</tbody></table></div>';
    return html;
  }

  function renderSettingsPage() {
    var s = state.status || {};
    var html = '<div class="pg-hdr"><h1>Settings</h1></div>';

    html += '<div class="settings-section">';
    html += '<h3>Vault Status</h3>';
    html += '<div class="settings-row"><span class="settings-label">Initialized</span><span class="settings-val">' + (s.initialized ? "Yes" : "No") + '</span></div>';
    html += '<div class="settings-row"><span class="settings-label">Locked</span><span class="settings-val">' + (s.locked ? "Yes" : "No") + '</span></div>';
    html += '<div class="settings-row"><span class="settings-label">Entries</span><span class="settings-val">' + (s.entryCount || 0) + '</span></div>';
    html += '</div>';

    html += '<div class="settings-section">';
    html += '<h3>File Paths</h3>';
    html += '<div class="settings-row"><span class="settings-label">Vault File</span><span class="settings-val">' + esc(CONFIG.vaultPath) + '</span></div>';
    html += '<div class="settings-row"><span class="settings-label">Log Directory</span><span class="settings-val">' + esc(CONFIG.logDir) + '</span></div>';
    html += '</div>';

    html += '<div class="settings-section">';
    html += '<h3>Actions</h3>';
    html += '<div class="settings-actions">';
    if (!s.locked) {
      html += '<button class="btn btn-danger" data-action="lock-vault">' + I.lock + ' Lock Vault</button>';
    }
    html += '<button class="btn btn-secondary" data-action="refresh-all">' + I.clock + ' Refresh Data</button>';
    html += '</div></div>';

    return html;
  }

  // --- Main render ---
  function render() {
    if (!state.loaded) return;
    if (!state.status || !state.status.initialized || state.status.locked) {
      showLockScreen();
      return;
    }
    hideLockScreen();
    var route = getRoute();
    renderNav(route.page);
    updateSidebarStatus();

    var page = document.getElementById("page");
    switch (route.page) {
      case "vault": page.innerHTML = renderVaultPage(); bindVaultEvents(); break;
      case "entry": page.innerHTML = renderEntryPage(route.id); break;
      case "add": page.innerHTML = renderAddPage(); break;
      case "logs": page.innerHTML = renderLogsPage(); break;
      case "settings": page.innerHTML = renderSettingsPage(); break;
      default: page.innerHTML = renderVaultPage(); bindVaultEvents(); break;
    }
  }

  function bindVaultEvents() {
    var input = document.getElementById("vault-search");
    if (input) {
      input.addEventListener("input", function() {
        state.search = this.value;
        render();
        var el = document.getElementById("vault-search");
        if (el) { el.focus(); el.selectionStart = el.selectionEnd = el.value.length; }
      });
    }
  }

  // --- Event delegation ---
  document.getElementById("page").addEventListener("click", function(e) {
    var btn = e.target.closest("[data-action]");
    if (!btn) return;
    var action = btn.dataset.action;

    if (action === "filter") {
      state.filter = btn.dataset.val;
      render();
      return;
    }

    if (action === "add-type") {
      state.addType = btn.dataset.val;
      render();
      return;
    }

    if (action === "toggle-field") {
      e.preventDefault();
      if (e.target.closest(".btn-icon")) return;
      var fid = btn.dataset.fid;
      state.expanded[fid] = !state.expanded[fid];
      render();
      return;
    }

    if (action === "copy-handle") {
      e.stopPropagation();
      navigator.clipboard.writeText(btn.dataset.handle).then(function() {
        toast("Handle copied", "success");
      });
      return;
    }

    if (action === "copy-totp") {
      navigator.clipboard.writeText(btn.dataset.code).then(function() {
        toast("TOTP code copied", "success");
      });
      return;
    }

    if (action === "gen-totp") {
      e.stopPropagation();
      api("/api/totp", { method: "POST", body: JSON.stringify({ handle: btn.dataset.handle }) })
        .then(function(res) {
          state.totp[btn.dataset.fid] = { code: res.code };
          render();
          toast("TOTP generated", "success");
        })
        .catch(function(err) { toast(err.message, "error"); });
      return;
    }

    if (action === "save-entry") {
      var entryId = btn.dataset.id;
      var grid = document.querySelector("[data-entry-id='" + entryId + "']");
      if (!grid) return;
      var entryType = grid.dataset.entryType;
      var payload = {
        label: grid.querySelector("[data-role='entry-label']").value,
        notes: grid.querySelector("[data-role='entry-notes']").value,
        tags: grid.querySelector("[data-role='entry-tags']").value
      };
      if (entryType === "login") payload.site = grid.querySelector("[data-role='entry-scope']").value;
      else payload.issuer = grid.querySelector("[data-role='entry-scope']").value;

      api("/api/entries/" + encodeURIComponent(entryId), { method: "PATCH", body: JSON.stringify(payload) })
        .then(function() { return refresh(); })
        .then(function() { toast("Entry saved", "success"); render(); })
        .catch(function(err) { toast(err.message, "error"); });
      return;
    }

    if (action === "remove-entry") {
      if (!confirm("Delete this entry and all its fields?")) return;
      api("/api/entries/" + encodeURIComponent(btn.dataset.id), { method: "DELETE" })
        .then(function() { return refresh(); })
        .then(function() { location.hash = "#/vault"; toast("Entry deleted", "success"); })
        .catch(function(err) { toast(err.message, "error"); });
      return;
    }

    if (action === "save-field") {
      var fieldId = btn.dataset.fid;
      var fieldItem = btn.closest(".field-item");
      var detail = fieldItem.querySelector(".field-detail");
      var value = detail.querySelector("[data-role='field-value']").value;
      var disabled = detail.querySelector("[data-role='field-disabled']").checked;
      var origins = detail.querySelector("[data-role='field-origins']").value;
      var allowedModes = [];
      detail.querySelectorAll("[data-mode]").forEach(function(cb) {
        if (cb.checked) allowedModes.push(cb.dataset.mode);
      });
      var body = {
        policy: { disabled: disabled, allowedOrigins: origins, allowedUseModes: allowedModes }
      };
      if (value.trim()) body.value = value;

      api("/api/fields/" + encodeURIComponent(fieldId), { method: "PATCH", body: JSON.stringify(body) })
        .then(function() { return refresh(); })
        .then(function() { toast("Field saved", "success"); render(); })
        .catch(function(err) { toast(err.message, "error"); });
      return;
    }

    if (action === "remove-field") {
      if (!confirm("Delete this field?")) return;
      api("/api/fields/" + encodeURIComponent(btn.dataset.fid), { method: "DELETE" })
        .then(function() { return refresh(); })
        .then(function() { toast("Field deleted", "success"); render(); })
        .catch(function(err) { toast(err.message, "error"); });
      return;
    }

    if (action === "add-field") {
      var addRow = btn.closest("[data-entry-add]");
      var eId = addRow.dataset.entryAdd;
      var fieldName = addRow.querySelector("[data-role='missing-name']").value;
      var fieldVal = addRow.querySelector("[data-role='missing-value']").value;
      api("/api/entries/" + encodeURIComponent(eId) + "/fields", {
        method: "POST",
        body: JSON.stringify({ fieldName: fieldName, value: fieldVal })
      })
        .then(function() { return refresh(); })
        .then(function() { toast("Field added", "success"); render(); })
        .catch(function(err) { toast(err.message, "error"); });
      return;
    }

    if (action === "submit-entry") {
      var key = document.getElementById("add-key");
      if (!key || !key.value.trim()) { toast("Key is required", "error"); return; }

      var isLogin = state.addType === "login";
      var url = isLogin ? "/api/entries/login" : "/api/entries/card";
      var body = {
        key: key.value.trim(),
        label: (document.getElementById("add-label") || {}).value || "",
        notes: (document.getElementById("add-notes") || {}).value || "",
        tags: (document.getElementById("add-tags") || {}).value || ""
      };

      if (isLogin) {
        body.site = (document.getElementById("add-site") || {}).value || "";
        body.fieldValues = {
          username: (document.getElementById("add-username") || {}).value || "",
          email: (document.getElementById("add-email") || {}).value || "",
          password: (document.getElementById("add-password") || {}).value || "",
          totp_seed: (document.getElementById("add-totp") || {}).value || ""
        };
      } else {
        body.issuer = (document.getElementById("add-issuer") || {}).value || "";
        body.fieldValues = {
          cardholder_name: (document.getElementById("add-name") || {}).value || "",
          card_number: (document.getElementById("add-number") || {}).value || "",
          expiry_month: (document.getElementById("add-month") || {}).value || "",
          expiry_year: (document.getElementById("add-year") || {}).value || "",
          cvv: (document.getElementById("add-cvv") || {}).value || "",
          billing_postal_code: (document.getElementById("add-postal") || {}).value || ""
        };
      }

      api(url, { method: "POST", body: JSON.stringify(body) })
        .then(function() { return refresh(); })
        .then(function() {
          toast("Entry created", "success");
          location.hash = "#/vault";
        })
        .catch(function(err) { toast(err.message, "error"); });
      return;
    }

    if (action === "lock-vault") {
      doLock();
      return;
    }

    if (action === "refresh-all") {
      refresh().then(function() { toast("Refreshed", "info"); render(); });
      return;
    }

    if (action === "refresh-logs") {
      api("/api/logs?limit=100").then(function(l) { state.logs = l; render(); toast("Logs refreshed", "info"); })
        .catch(function(err) { toast(err.message, "error"); });
      return;
    }
  });

  // Sidebar lock button
  document.getElementById("sb-lock").addEventListener("click", doLock);

  // Hash routing
  window.addEventListener("hashchange", render);

  // Passphrase enter key on lock screen
  document.getElementById("passphrase").addEventListener("keydown", function(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      var s = state.status;
      if (!s || !s.initialized) doInit();
      else doUnlock();
    }
  });

  // Boot
  refresh()
    .then(function() { render(); })
    .catch(function(err) {
      state.loaded = true;
      state.status = { initialized: false, locked: true, entryCount: 0 };
      render();
    });
})();
</script>

</body>
</html>`;
}
