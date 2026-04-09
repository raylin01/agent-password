import test from "node:test";
import assert from "node:assert/strict";

import { generateTotp } from "../src/lib/totp.mjs";

test("generates RFC-compatible TOTP codes", () => {
  const result = generateTotp("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", {
    digits: 8,
    period: 30,
    time: 59_000
  });

  assert.equal(result.code, "94287082");
});
