import test from "node:test";
import assert from "node:assert/strict";

import { redactSecrets, replaceHandles } from "../src/lib/substitution.mjs";

test("replaces handles in text", () => {
  const map = new Map([
    ["COSTCO_COM_USERNAME_1", "ray@example.com"],
    ["COSTCO_COM_PASSWORD_1", "hunter2"]
  ]);

  const result = replaceHandles("login COSTCO_COM_USERNAME_1 COSTCO_COM_PASSWORD_1", map);
  assert.equal(result, "login ray@example.com hunter2");
});

test("replaces wrapped handles in text", () => {
  const map = new Map([
    ["COSTCO_COM_PASSWORD_1", "hunter2"]
  ]);

  const result = replaceHandles("password={{ COSTCO_COM_PASSWORD_1 }}", map);
  assert.equal(result, "password=hunter2");
});

test("redacts secrets back to handles", () => {
  const map = new Map([
    ["COSTCO_COM_PASSWORD_1", "hunter2"]
  ]);

  const result = redactSecrets("password=hunter2", map);
  assert.equal(result, "password=COSTCO_COM_PASSWORD_1");
});
