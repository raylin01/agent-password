import test from "node:test";
import assert from "node:assert/strict";

import { checkFieldPolicy, normalizePolicy } from "../src/lib/policy.mjs";

test("policy allows browser fill on an allowed origin", () => {
  const field = {
    policy: normalizePolicy({
      allowedUseModes: ["browser_fill"],
      allowedOrigins: ["https://www.costco.com"]
    })
  };

  const result = checkFieldPolicy(field, {
    useMode: "browser_fill",
    origin: "https://www.costco.com/account/login"
  });

  assert.equal(result.allowed, true);
  assert.equal(result.normalizedOrigin, "https://www.costco.com");
});

test("policy denies browser fill on a different origin", () => {
  const field = {
    policy: normalizePolicy({
      allowedUseModes: ["browser_fill"],
      allowedOrigins: ["https://www.costco.com"]
    })
  };

  const result = checkFieldPolicy(field, {
    useMode: "browser_fill",
    origin: "https://evil.example/login"
  });

  assert.equal(result.allowed, false);
  assert.match(result.reason, /not allowed/i);
});
