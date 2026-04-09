import test from "node:test";
import assert from "node:assert/strict";

import { createEntry, normalizeLoadedVault, sanitizeEntry, VAULT_VERSION } from "../src/lib/vault-schema.mjs";

test("creates typed login entries with label-derived handles", () => {
  const entry = createEntry({
    entryType: "login",
    label: "Costco",
    site: "https://www.costco.com",
    fieldValues: {
      username: "ray@example.com",
      password: "hunter2",
      totp_seed: "JBSWY3DPEHPK3PXP"
    }
  });

  assert.equal(entry.entryType, "login");
  assert.equal(entry.key, "costco");
  assert.equal(entry.fields.length, 3);
  assert.equal(entry.fields[0].handle, "COSTCO_USERNAME_1");

  const sanitized = sanitizeEntry(entry);
  assert.equal(sanitized.fields[0].previewMasked.includes("ray@example.com"), false);
});

test("creates free-form secret entries with provider metadata", () => {
  const entry = createEntry({
    entryType: "secret",
    label: "Cloudflare",
    provider: "Cloudflare",
    fields: [
      { name: "api_token", value: "super-secret-token" },
      { name: "account_id", value: "acct_123" }
    ]
  });

  assert.equal(entry.entryType, "secret");
  assert.equal(entry.provider, "Cloudflare");
  assert.equal(entry.fields[0].fieldName, "api_token");
  assert.equal(entry.fields[0].handle, "CLOUDFLARE_API_TOKEN_1");
  assert.deepEqual(entry.expectedFieldNames, []);
});

test("normalizes version two vaults into version three without changing stored handles", () => {
  const loaded = normalizeLoadedVault({
    version: 2,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    entries: [
      {
        id: "entry_1",
        entryType: "login",
        key: "costco.com",
        label: "Costco",
        site: "https://www.costco.com",
        fields: [
          {
            id: "field_1",
            fieldName: "password",
            handle: "COSTCO_COM_PASSWORD_1",
            value: "hunter2"
          }
        ]
      }
    ]
  });

  assert.equal(loaded.version, VAULT_VERSION);
  assert.equal(loaded.entries[0].key, "costco-com");
  assert.equal(loaded.entries[0].fields[0].handle, "COSTCO_COM_PASSWORD_1");
});
