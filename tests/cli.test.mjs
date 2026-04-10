import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";

const CLI_PATH = path.resolve("src/cli.mjs");
const CLI_MODULE_URL = pathToFileURL(CLI_PATH).href;

async function runCliWithMock(args, { routes, input } = {}) {
  const script = `
    const routes = ${JSON.stringify(routes || {})};

    globalThis.fetch = async (url, options = {}) => {
      const parsed = new URL(url);
      const method = String(options.method || "GET").toUpperCase();
      const key = \`\${method} \${parsed.pathname}\${parsed.search}\`;
      const route = routes[key];

      if (!route) {
        throw new Error(\`Unexpected fetch: \${key}\`);
      }

      if (route.expectedBody !== undefined) {
        const actualBody = JSON.parse(options.body || "{}");

        if (JSON.stringify(actualBody) !== JSON.stringify(route.expectedBody)) {
          return {
            ok: false,
            status: 400,
            async json() {
              return {
                error: \`Unexpected request body for \${key}: \${JSON.stringify(actualBody)}\`
              };
            }
          };
        }
      }

      return {
        ok: route.ok !== false,
        status: route.status || 200,
        async json() {
          return route.payload;
        }
      };
    };

    process.env.AGENTPASS_BASE_URL = "http://agentpass.test";
    process.argv = ["node", ${JSON.stringify(CLI_PATH)}, ...${JSON.stringify(args)}];
    await import(${JSON.stringify(CLI_MODULE_URL)});
  `;

  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--input-type=module", "-e", script], {
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        code,
        stdout,
        stderr
      });
    });

    if (input !== undefined) {
      child.stdin.write(input);
    }

    child.stdin.end();
  });
}

test("cli can print a single handle for an entry", async () => {
  const result = await runCliWithMock([
    "get-entry",
    "Costco",
    "--output",
    "handle",
    "--field-name",
    "password"
  ], {
    routes: {
      "GET /api/entries/Costco": {
        payload: {
          id: "entry_1",
          key: "costco",
          entryType: "login",
          label: "Costco",
          site: "https://www.costco.com",
          issuer: "",
          provider: "",
          notes: "",
          tags: [],
          createdAt: "2026-04-09T00:00:00.000Z",
          updatedAt: "2026-04-09T00:00:00.000Z",
          expectedFieldNames: ["username", "email", "password", "totp_seed"],
          fields: [
            {
              id: "field_1",
              handle: "COSTCO_PASSWORD_1",
              fieldName: "password",
              fieldType: "password",
              previewMasked: "h*****2",
              policy: {
                disabled: false,
                allowedUseModes: ["browser_fill", "file_render"],
                allowedOrigins: []
              },
              createdAt: "2026-04-09T00:00:00.000Z",
              updatedAt: "2026-04-09T00:00:00.000Z",
              lastUsedAt: null
            }
          ]
        }
      }
    }
  });

  assert.equal(result.code, 0);
  assert.equal(result.stdout.trim(), "COSTCO_PASSWORD_1");
  assert.equal(result.stderr, "");
});

test("cli totp --code-only prints just the code", async () => {
  const result = await runCliWithMock([
    "totp",
    "GITHUB_TOTP_SEED_1",
    "--code-only"
  ], {
    routes: {
      "POST /api/totp": {
        expectedBody: {
          handle: "GITHUB_TOTP_SEED_1"
        },
        payload: {
          handle: "GITHUB_TOTP_SEED_1",
          code: "123456",
          expiresAt: "2026-04-09T00:00:30.000Z"
        }
      }
    }
  });

  assert.equal(result.code, 0);
  assert.equal(result.stdout, "123456\n");
  assert.equal(result.stderr, "");
});

test("cli can read a secret value from stdin on add-login", async () => {
  const result = await runCliWithMock([
    "add-login",
    "--label",
    "Stdin Secret",
    "--password",
    "-",
    "--output",
    "handle",
    "--field-name",
    "password"
  ], {
    input: "hunter2\n",
    routes: {
      "POST /api/entries/login": {
        expectedBody: {
          label: "Stdin Secret",
          fieldValues: {
            username: undefined,
            email: undefined,
            password: "hunter2",
            totp_seed: undefined
          }
        },
        payload: {
          id: "entry_1",
          key: "stdin-secret",
          entryType: "login",
          label: "Stdin Secret",
          site: "",
          issuer: "",
          provider: "",
          notes: "",
          tags: [],
          createdAt: "2026-04-09T00:00:00.000Z",
          updatedAt: "2026-04-09T00:00:00.000Z",
          expectedFieldNames: ["username", "email", "password", "totp_seed"],
          fields: [
            {
              id: "field_1",
              handle: "STDIN_SECRET_PASSWORD_1",
              fieldName: "password",
              fieldType: "password",
              previewMasked: "h*****2",
              policy: {
                disabled: false,
                allowedUseModes: ["browser_fill", "file_render"],
                allowedOrigins: []
              },
              createdAt: "2026-04-09T00:00:00.000Z",
              updatedAt: "2026-04-09T00:00:00.000Z",
              lastUsedAt: null
            }
          ]
        }
      }
    }
  });

  assert.equal(result.code, 0);
  assert.equal(result.stdout.trim(), "STDIN_SECRET_PASSWORD_1");
  assert.equal(result.stderr, "");
});

test("cli list supports type and match filters", async () => {
  const result = await runCliWithMock([
    "list",
    "--type",
    "login",
    "--match",
    "costco"
  ], {
    routes: {
      "GET /api/entries?type=login&match=costco": {
        payload: [
          {
            id: "entry_1",
            key: "costco",
            entryType: "login",
            label: "Costco",
            site: "https://www.costco.com",
            issuer: "",
            provider: "",
            notes: "",
            tags: [],
            createdAt: "2026-04-09T00:00:00.000Z",
            updatedAt: "2026-04-09T00:00:00.000Z",
            expectedFieldNames: ["username", "email", "password", "totp_seed"],
            fields: [
              {
                id: "field_1",
                handle: "COSTCO_PASSWORD_1",
                fieldName: "password",
                fieldType: "password",
                previewMasked: "h*****2",
                policy: {
                  disabled: false,
                  allowedUseModes: ["browser_fill", "file_render"],
                  allowedOrigins: []
                },
                createdAt: "2026-04-09T00:00:00.000Z",
                updatedAt: "2026-04-09T00:00:00.000Z",
                lastUsedAt: null
              }
            ]
          }
        ]
      }
    }
  });

  assert.equal(result.code, 0);
  assert.match(result.stdout, /Costco \(login\)/u);
  assert.doesNotMatch(result.stdout, /AWS Prod/u);
  assert.equal(result.stderr, "");
});
