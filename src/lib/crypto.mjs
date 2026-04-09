import crypto from "node:crypto";

const KDF_CONFIG = Object.freeze({
  name: "scrypt",
  keyLength: 32,
  N: 16384,
  r: 8,
  p: 1
});

export function encryptVault(vault, passphrase) {
  if (!passphrase) {
    throw new Error("A passphrase is required.");
  }

  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(passphrase, salt, KDF_CONFIG.keyLength, {
    N: KDF_CONFIG.N,
    r: KDF_CONFIG.r,
    p: KDF_CONFIG.p,
    maxmem: 64 * 1024 * 1024
  });
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(vault), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    version: 1,
    kdf: {
      ...KDF_CONFIG,
      salt: salt.toString("base64")
    },
    cipher: {
      name: "aes-256-gcm",
      iv: iv.toString("base64"),
      tag: tag.toString("base64")
    },
    ciphertext: ciphertext.toString("base64")
  };
}

export function decryptVault(envelope, passphrase) {
  if (!passphrase) {
    throw new Error("A passphrase is required.");
  }

  if (!envelope || envelope.version !== 1) {
    throw new Error("Unsupported vault format.");
  }

  try {
    const salt = Buffer.from(envelope.kdf.salt, "base64");
    const iv = Buffer.from(envelope.cipher.iv, "base64");
    const tag = Buffer.from(envelope.cipher.tag, "base64");
    const ciphertext = Buffer.from(envelope.ciphertext, "base64");
    const key = crypto.scryptSync(passphrase, salt, envelope.kdf.keyLength, {
      N: envelope.kdf.N,
      r: envelope.kdf.r,
      p: envelope.kdf.p,
      maxmem: 64 * 1024 * 1024
    });
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(plaintext.toString("utf8"));
  } catch (error) {
    throw new Error("Unable to decrypt vault. The passphrase may be incorrect or the file may be corrupted.");
  }
}
