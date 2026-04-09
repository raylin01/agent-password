import crypto from "node:crypto";

function parseOtpauthSecret(value) {
  const stringValue = String(value ?? "").trim();

  if (!stringValue.startsWith("otpauth://")) {
    return stringValue;
  }

  const url = new URL(stringValue);
  return url.searchParams.get("secret") || "";
}

function base32Value(character) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  return alphabet.indexOf(character);
}

export function decodeBase32(input) {
  const normalized = parseOtpauthSecret(input)
    .toUpperCase()
    .replace(/=+$/g, "")
    .replace(/[^A-Z2-7]/g, "");

  if (!normalized) {
    throw new Error("TOTP secret is empty.");
  }

  let bits = "";

  for (const character of normalized) {
    const value = base32Value(character);

    if (value === -1) {
      throw new Error("TOTP secret is not valid base32.");
    }

    bits += value.toString(2).padStart(5, "0");
  }

  const bytes = [];

  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }

  return Buffer.from(bytes);
}

export function generateTotp(secretValue, { digits = 6, period = 30, time = Date.now() } = {}) {
  const secret = decodeBase32(secretValue);
  const counter = BigInt(Math.floor(time / 1000 / period));
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(counter);

  const hmac = crypto.createHmac("sha1", secret).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff);
  const code = String(binary % (10 ** digits)).padStart(digits, "0");
  const expiresAt = (Math.floor(time / 1000 / period) + 1) * period * 1000;

  return {
    code,
    digits,
    period,
    counter: Number(counter),
    expiresAt
  };
}
