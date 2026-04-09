import crypto from "node:crypto";

export function nowIso() {
  return new Date().toISOString();
}

export function randomId(prefix = "") {
  return `${prefix}${crypto.randomUUID()}`;
}

export function normalizeEntryKey(input) {
  const normalized = String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!normalized) {
    throw new Error("Entry key cannot be empty.");
  }

  return normalized;
}

export function normalizeHandlePart(input) {
  const normalized = String(input || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || "SECRET";
}

export function createHandle(entryKey, fieldName, index = 1) {
  return [
    normalizeHandlePart(entryKey),
    normalizeHandlePart(fieldName),
    String(index)
  ].join("_");
}

export function uniqueStrings(values) {
  return [...new Set(values)];
}

export function normalizeStringList(values) {
  const parts = Array.isArray(values) ? values : [values];

  return uniqueStrings(
    parts
      .flatMap((value) => String(value ?? "").split(","))
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

export function maskValue(value) {
  const stringValue = String(value ?? "");

  if (!stringValue) {
    return "";
  }

  if (stringValue.length <= 2) {
    return "*".repeat(stringValue.length);
  }

  const middleLength = Math.max(3, stringValue.length - 2);
  return `${stringValue.slice(0, 1)}${"*".repeat(middleLength)}${stringValue.slice(-1)}`;
}

export function parseCommandTail(argv) {
  const separatorIndex = argv.indexOf("--");

  if (separatorIndex === -1) {
    return {
      head: [...argv],
      tail: []
    };
  }

  return {
    head: argv.slice(0, separatorIndex),
    tail: argv.slice(separatorIndex + 1)
  };
}

export function parseOptionValue(args, optionName) {
  const index = args.indexOf(optionName);

  if (index === -1) {
    return undefined;
  }

  if (index === args.length - 1) {
    throw new Error(`Missing value for ${optionName}.`);
  }

  return args[index + 1];
}

export function hasFlag(args, flagName) {
  return args.includes(flagName);
}

export function withoutOption(args, optionName, consumesValue = false) {
  const result = [];

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];

    if (current !== optionName) {
      result.push(current);
      continue;
    }

    if (consumesValue) {
      index += 1;
    }
  }

  return result;
}

export function trimToUndefined(value) {
  const stringValue = String(value ?? "").trim();
  return stringValue || undefined;
}

export function coerceBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value ?? "").trim().toLowerCase();

  if (!normalized) {
    return undefined;
  }

  if (["true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "off"].includes(normalized)) {
    return false;
  }

  throw new Error(`Unable to parse boolean value: ${value}`);
}

export function stableJsonValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => stableJsonValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableJsonValue(value[key])])
    );
  }

  return value;
}

export function stableStringify(value) {
  return JSON.stringify(stableJsonValue(value));
}

export function sha256Hex(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}
