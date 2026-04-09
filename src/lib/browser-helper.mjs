const DEFAULT_BASE_URL = "http://127.0.0.1:4765";
const redactionMap = new Map();
let redactorInstalled = false;

function redactText(text) {
  let output = String(text);
  const pairs = [...redactionMap.entries()].sort((left, right) => right[1].length - left[1].length);

  for (const [handle, value] of pairs) {
    if (!value) {
      continue;
    }

    output = output.split(value).join(handle);
  }

  return output;
}

function installRedactor() {
  if (redactorInstalled) {
    return;
  }

  redactorInstalled = true;

  for (const streamName of ["stdout", "stderr"]) {
    const stream = process[streamName];
    const originalWrite = stream.write.bind(stream);

    stream.write = (chunk, encoding, callback) => {
      if (Buffer.isBuffer(chunk) || chunk instanceof Uint8Array) {
        if (typeof encoding === "function") {
          return originalWrite(chunk, encoding);
        }

        if (typeof callback === "function") {
          return originalWrite(chunk, encoding, callback);
        }

        return originalWrite(chunk, encoding);
      }

      const redacted = redactText(String(chunk));

      if (typeof encoding === "function") {
        return originalWrite(redacted, encoding);
      }

      if (typeof callback === "function") {
        return originalWrite(redacted, encoding, callback);
      }

      return originalWrite(redacted, encoding);
    };
  }
}

function registerSecret(handle, value) {
  if (!value) {
    return;
  }

  installRedactor();
  redactionMap.set(handle, String(value));
}

async function requestJson(baseUrl, path, body, options = {}) {
  const response = await (options.fetchImpl || globalThis.fetch)(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-agentpass-actor-type": options.actorType || "agent",
      "x-agentpass-actor-id": options.actorId || "browser-template"
    },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || `Request failed with status ${response.status}.`);
  }

  return payload;
}

function inferOrigin(page, explicitOrigin) {
  if (explicitOrigin) {
    return explicitOrigin;
  }

  if (page && typeof page.url === "function") {
    try {
      return new URL(page.url()).origin;
    } catch {
      return undefined;
    }
  }

  return undefined;
}

async function fillViaPage(page, selector, value) {
  if (typeof page.fill === "function") {
    await page.fill(selector, value);
    return;
  }

  if (typeof page.locator === "function") {
    await page.locator(selector).fill(value);
    return;
  }

  throw new Error("The provided page object does not support fill.");
}

async function clickViaPage(page, selector) {
  if (typeof page.click === "function") {
    await page.click(selector);
    return;
  }

  if (typeof page.locator === "function") {
    await page.locator(selector).click();
    return;
  }

  throw new Error("The provided page object does not support click.");
}

export async function createAgentPassBrowser(options = {}) {
  const baseUrl = options.baseUrl || process.env.AGENTPASS_BASE_URL || DEFAULT_BASE_URL;
  const shared = {
    actorType: options.actorType || "agent",
    actorId: options.actorId || "browser-template",
    fetchImpl: options.fetchImpl
  };

  return {
    async fillHandle(page, selector, handle, origin) {
      const finalOrigin = inferOrigin(page, origin);
      const payload = await requestJson(baseUrl, "/api/browser-fill", {
        handle,
        origin: finalOrigin
      }, shared);
      registerSecret(handle, payload.value);

      await fillViaPage(page, selector, payload.value);

      return {
        handle,
        selector,
        origin: finalOrigin,
        fieldName: payload.fieldName
      };
    },

    async fillLogin(page, config) {
      if (config.usernameHandle && config.usernameSelector) {
        await this.fillHandle(page, config.usernameSelector, config.usernameHandle, config.origin);
      }

      if (config.emailHandle && config.emailSelector) {
        await this.fillHandle(page, config.emailSelector, config.emailHandle, config.origin);
      }

      if (config.passwordHandle && config.passwordSelector) {
        await this.fillHandle(page, config.passwordSelector, config.passwordHandle, config.origin);
      }

      if (config.totpHandle && config.totpSelector) {
        await this.fillHandle(page, config.totpSelector, config.totpHandle, config.origin);
      }
    },

    async click(page, selector) {
      await clickViaPage(page, selector);
    },

    async totp(handle) {
      const payload = await requestJson(baseUrl, "/api/totp", {
        handle
      }, shared);

      registerSecret(handle, payload.code);
      return payload;
    }
  };
}
