import http from "node:http";

import { sendHtml, sendJson, sendNotFound, readJsonBody } from "./lib/http.mjs";
import { AgentPassService, isLockedError } from "./lib/service.mjs";
import { renderPage } from "./ui/page.mjs";

function actorFromRequest(request) {
  return {
    actor_type: request.headers["x-agentpass-actor-type"] || "system",
    actor_id: request.headers["x-agentpass-actor-id"] || "agentpass-http"
  };
}

function routeMatch(pathname, pattern) {
  const match = pathname.match(pattern);
  return match ? match.slice(1).map((value) => decodeURIComponent(value)) : null;
}

export async function startServer({ host = "127.0.0.1", port = 4765, dataDir, vaultPath, logDir }) {
  const service = new AgentPassService({
    dataDir,
    vaultPath,
    logDir
  });

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`);
    const actor = actorFromRequest(request);

    try {
      if (request.method === "GET" && url.pathname === "/") {
        sendHtml(response, renderPage({
          vaultPath: service.paths.vaultPath,
          logDir: service.paths.logDir
        }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/status") {
        sendJson(response, 200, await service.status());
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/init") {
        const body = await readJsonBody(request);
        sendJson(response, 200, await service.init(body.passphrase, actor));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/unlock") {
        const body = await readJsonBody(request);
        sendJson(response, 200, await service.unlock(body.passphrase, actor));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/lock") {
        sendJson(response, 200, await service.lock(actor));
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/entries") {
        sendJson(response, 200, service.listEntries({
          type: url.searchParams.get("type"),
          query: url.searchParams.get("match"),
          tag: url.searchParams.get("tag")
        }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/entries/login") {
        const body = await readJsonBody(request);
        sendJson(response, 200, await service.createLoginEntry(body, actor));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/entries/card") {
        const body = await readJsonBody(request);
        sendJson(response, 200, await service.createCardEntry(body, actor));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/entries/secret") {
        const body = await readJsonBody(request);
        sendJson(response, 200, await service.createSecretEntry(body, actor));
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/logs") {
        sendJson(response, 200, await service.listLogs(Number(url.searchParams.get("limit") || 50)));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/totp") {
        const body = await readJsonBody(request);
        sendJson(response, 200, await service.generateTotpCode(body.handle, actor));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/browser-fill") {
        const body = await readJsonBody(request);
        sendJson(response, 200, await service.prepareBrowserFill(body.handle, body.origin, actor));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/render-file") {
        const body = await readJsonBody(request);
        sendJson(response, 200, await service.renderFile({
          templatePath: body.templatePath,
          templateContent: body.templateContent,
          templateLabel: body.templateLabel,
          outputPath: body.outputPath,
          command: body.command,
          cwd: body.cwd,
          timeoutMs: body.timeoutMs,
          keep: body.keep,
          actor
        }));
        return;
      }

      const entryMatch = routeMatch(url.pathname, /^\/api\/entries\/([^/]+)$/u);

      if (entryMatch && request.method === "GET") {
        const entry = service.getEntry(entryMatch[0]);

        if (!entry) {
          sendNotFound(response);
          return;
        }

        sendJson(response, 200, entry);
        return;
      }

      if (entryMatch && request.method === "PATCH") {
        const body = await readJsonBody(request);
        sendJson(response, 200, await service.updateEntry(entryMatch[0], body, actor));
        return;
      }

      if (entryMatch && request.method === "DELETE") {
        sendJson(response, 200, await service.removeEntry(entryMatch[0], actor));
        return;
      }

      const entryFieldMatch = routeMatch(url.pathname, /^\/api\/entries\/([^/]+)\/fields$/u);

      if (entryFieldMatch && request.method === "POST") {
        const body = await readJsonBody(request);
        sendJson(response, 200, await service.addField(entryFieldMatch[0], body.fieldName, body.value, actor, body.policy));
        return;
      }

      const fieldMatch = routeMatch(url.pathname, /^\/api\/fields\/([^/]+)$/u);

      if (fieldMatch && request.method === "PATCH") {
        const body = await readJsonBody(request);
        sendJson(response, 200, await service.updateField(fieldMatch[0], body, actor));
        return;
      }

      if (fieldMatch && request.method === "DELETE") {
        sendJson(response, 200, await service.removeField(fieldMatch[0], actor));
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

  const address = server.address();
  const resolvedPort = typeof address === "object" && address ? address.port : port;

  return {
    host,
    port: resolvedPort,
    server,
    service
  };
}
