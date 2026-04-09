import fs from "node:fs/promises";
import path from "node:path";

import { decryptVault, encryptVault } from "./crypto.mjs";
import { createEmptyVault, normalizeLoadedVault } from "./vault-schema.mjs";

export { createEmptyVault };

export async function vaultExists(vaultPath) {
  try {
    await fs.access(vaultPath);
    return true;
  } catch {
    return false;
  }
}

export async function readEnvelope(vaultPath) {
  const raw = await fs.readFile(vaultPath, "utf8");
  return JSON.parse(raw);
}

export async function readVault(vaultPath, passphrase) {
  const envelope = await readEnvelope(vaultPath);
  return normalizeLoadedVault(decryptVault(envelope, passphrase));
}

export async function writeVault(vaultPath, vault, passphrase) {
  const envelope = encryptVault(vault, passphrase);
  const directory = path.dirname(vaultPath);
  const tempPath = `${vaultPath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;

  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(tempPath, JSON.stringify(envelope, null, 2), {
    encoding: "utf8",
    mode: 0o600
  });
  await fs.rename(tempPath, vaultPath);
  await fs.chmod(vaultPath, 0o600);
}
