import fs from "node:fs/promises";
import path from "node:path";

import { ensureDataPaths } from "./paths.mjs";
import { nowIso, randomId, sha256Hex, stableStringify } from "./util.mjs";

function logFileNameForTimestamp(timestamp) {
  return `audit-${timestamp.slice(0, 10)}.jsonl`;
}

function normalizeAuditEvent(event) {
  return {
    event_id: event.event_id,
    timestamp: event.timestamp,
    actor_type: event.actor_type,
    actor_id: event.actor_id,
    action: event.action,
    target_type: event.target_type || null,
    target_id: event.target_id || null,
    handle: event.handle || null,
    origin: event.origin || null,
    file_path: event.file_path || null,
    result: event.result || "success",
    message: event.message || null,
    prev_hash: event.prev_hash || null
  };
}

async function listLogFiles(logDir) {
  try {
    const entries = await fs.readdir(logDir);
    return entries
      .filter((entry) => entry.startsWith("audit-") && entry.endsWith(".jsonl"))
      .sort();
  } catch {
    return [];
  }
}

async function readLastEventHash(logDir) {
  const files = await listLogFiles(logDir);
  const latestFile = files[files.length - 1];

  if (!latestFile) {
    return null;
  }

  const content = await fs.readFile(path.join(logDir, latestFile), "utf8");
  const lastLine = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .pop();

  if (!lastLine) {
    return null;
  }

  return JSON.parse(lastLine).event_hash || null;
}

export class AuditLog {
  constructor(paths) {
    this.paths = paths;
  }

  async append(event) {
    await ensureDataPaths(this.paths);
    const timestamp = event.timestamp || nowIso();
    const prevHash = await readLastEventHash(this.paths.logDir);
    const normalized = normalizeAuditEvent({
      event_id: randomId("evt_"),
      timestamp,
      actor_type: event.actor_type || "system",
      actor_id: event.actor_id || "agentpass",
      action: event.action,
      target_type: event.target_type,
      target_id: event.target_id,
      handle: event.handle,
      origin: event.origin,
      file_path: event.file_path,
      result: event.result,
      message: event.message,
      prev_hash: prevHash
    });
    const event_hash = sha256Hex(stableStringify(normalized));
    const finalEvent = {
      ...normalized,
      event_hash
    };
    const filePath = path.join(this.paths.logDir, logFileNameForTimestamp(timestamp));

    await fs.appendFile(filePath, `${JSON.stringify(finalEvent)}\n`, {
      encoding: "utf8",
      mode: 0o600
    });
    await fs.chmod(filePath, 0o600);

    return finalEvent;
  }

  async list({ limit = 200 } = {}) {
    const files = (await listLogFiles(this.paths.logDir)).reverse();
    const events = [];

    for (const fileName of files) {
      const content = await fs.readFile(path.join(this.paths.logDir, fileName), "utf8");
      const lines = content
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .reverse();

      for (const line of lines) {
        events.push(JSON.parse(line));

        if (events.length >= limit) {
          return events;
        }
      }
    }

    return events;
  }
}
