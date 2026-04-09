import test from "node:test";
import assert from "node:assert/strict";

import { createEntry, sanitizeEntry } from "../src/lib/vault-schema.mjs";

test("creates typed login entries with handles", () => {
  const entry = createEntry({
    entryType: "login",
    key: "costco.com",
    label: "Costco",
    site: "https://www.costco.com",
    fieldValues: {
      username: "ray@example.com",
      password: "hunter2",
      totp_seed: "JBSWY3DPEHPK3PXP"
    }
  });

  assert.equal(entry.entryType, "login");
  assert.equal(entry.fields.length, 3);
  assert.equal(entry.fields[0].handle, "COSTCO_COM_USERNAME_1");

  const sanitized = sanitizeEntry(entry);
  assert.equal(sanitized.fields[0].previewMasked.includes("ray@example.com"), false);
});
