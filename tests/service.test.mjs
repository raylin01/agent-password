import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { AgentPassService } from "../src/lib/service.mjs";

test("service stores fields and preserves opaque handles", async () => {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "agentpass-test-"));
  const vaultPath = path.join(tempDirectory, "vault.json");
  const service = new AgentPassService({ vaultPath });

  try {
    await service.init("top-secret-passphrase");
    const entry = await service.putField({
      entryKey: "costco.com",
      label: "Costco",
      name: "password",
      type: "password",
      value: "hunter2"
    });

    assert.equal(entry.fields[0].handle, "COSTCO_COM_PASSWORD_1");
    assert.equal(service.resolveHandle("COSTCO_COM_PASSWORD_1"), "hunter2");
  } finally {
    await fs.rm(tempDirectory, {
      recursive: true,
      force: true
    });
  }
});
