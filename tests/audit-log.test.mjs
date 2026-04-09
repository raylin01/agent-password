import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { AuditLog } from "../src/lib/audit-log.mjs";

test("audit log appends hash-chained events", async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "agentpass-audit-"));
  const log = new AuditLog({
    dataDir,
    logDir: path.join(dataDir, "logs")
  });

  try {
    const first = await log.append({
      actor_type: "system",
      actor_id: "test",
      action: "vault.init"
    });
    const second = await log.append({
      actor_type: "system",
      actor_id: "test",
      action: "vault.unlock"
    });
    const events = await log.list({
      limit: 10
    });

    assert.equal(events.length, 2);
    assert.equal(second.prev_hash, first.event_hash);
    assert.equal(events[0].event_hash, second.event_hash);
  } finally {
    await fs.rm(dataDir, {
      recursive: true,
      force: true
    });
  }
});
