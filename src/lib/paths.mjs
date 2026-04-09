import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

const DEFAULT_DIRECTORY_NAME = ".agentpass";

export function defaultDataDir() {
  return path.join(os.homedir(), DEFAULT_DIRECTORY_NAME);
}

export function resolveDataPaths({ dataDir, vaultPath, logDir, configPath } = {}) {
  const resolvedDataDir = path.resolve(dataDir || path.dirname(vaultPath || path.join(defaultDataDir(), "vault.enc.json")));

  return {
    dataDir: resolvedDataDir,
    vaultPath: path.resolve(vaultPath || path.join(resolvedDataDir, "vault.enc.json")),
    logDir: path.resolve(logDir || path.join(resolvedDataDir, "logs")),
    configPath: path.resolve(configPath || path.join(resolvedDataDir, "config.json"))
  };
}

export async function ensureDataPaths(paths) {
  await fs.mkdir(paths.dataDir, {
    recursive: true,
    mode: 0o700
  });
  await fs.mkdir(paths.logDir, {
    recursive: true,
    mode: 0o700
  });
}
