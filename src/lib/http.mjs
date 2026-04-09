export async function readJsonBody(request) {
  let body = "";

  for await (const chunk of request) {
    body += chunk.toString();

    if (body.length > 1024 * 1024) {
      throw new Error("Request body is too large.");
    }
  }

  if (!body) {
    return {};
  }

  return JSON.parse(body);
}

export function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload, null, 2));
}

export function sendHtml(response, html) {
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8"
  });
  response.end(html);
}

export function sendNotFound(response) {
  sendJson(response, 404, {
    error: "Not found."
  });
}
