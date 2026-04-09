import test from "node:test";
import assert from "node:assert/strict";

import { decryptVault, encryptVault } from "../src/lib/crypto.mjs";

test("vault encryption round-trips", () => {
  const vault = {
    version: 1,
    entries: [
      {
        key: "costco-com",
        fields: [
          {
            handle: "COSTCO_COM_PASSWORD_1",
            value: "super-secret"
          }
        ]
      }
    ]
  };

  const encrypted = encryptVault(vault, "correct horse battery staple");
  const decrypted = decryptVault(encrypted, "correct horse battery staple");

  assert.deepEqual(decrypted, vault);
});
