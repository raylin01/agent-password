import test from "node:test";
import assert from "node:assert/strict";

import { createAgentPassBrowser } from "../src/lib/browser-helper.mjs";

test("browser helper resolves a handle and fills a page field", async () => {
  const requests = [];
  const page = {
    filled: [],
    url() {
      return "https://www.costco.com/login";
    },
    async fill(selector, value) {
      this.filled.push({
        selector,
        value
      });
    }
  };
  const browser = await createAgentPassBrowser({
    baseUrl: "http://agentpass.test",
    fetchImpl: async (url, options) => {
      requests.push({
        url,
        options
      });

      return {
        ok: true,
        async json() {
          return {
            fieldName: "password",
            value: "hunter2"
          };
        }
      };
    }
  });

  await browser.fillHandle(page, "#password", "COSTCO_COM_PASSWORD_1");

  assert.equal(requests.length, 1);
  assert.equal(JSON.parse(requests[0].options.body).origin, "https://www.costco.com");
  assert.deepEqual(page.filled[0], {
    selector: "#password",
    value: "hunter2"
  });
});

test("browser helper fetches TOTP codes", async () => {
  const browser = await createAgentPassBrowser({
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          handle: "GITHUB_COM_TOTP_1",
          code: "123456"
        };
      }
    })
  });

  const result = await browser.totp("GITHUB_COM_TOTP_1");

  assert.equal(result.code, "123456");
});
