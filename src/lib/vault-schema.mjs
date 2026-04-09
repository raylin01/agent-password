import { normalizePolicy } from "./policy.mjs";
import { createHandle, maskValue, normalizeEntryKey, normalizeStringList, nowIso, randomId, trimToUndefined } from "./util.mjs";

export const VAULT_VERSION = 2;

const ENTRY_DEFINITIONS = Object.freeze({
  login: {
    entryType: "login",
    fieldDefinitions: {
      username: {
        fieldType: "username",
        defaultUseModes: ["browser_fill", "file_render"]
      },
      email: {
        fieldType: "email",
        defaultUseModes: ["browser_fill", "file_render"]
      },
      password: {
        fieldType: "password",
        defaultUseModes: ["browser_fill", "file_render"]
      },
      totp_seed: {
        fieldType: "totp_seed",
        defaultUseModes: ["browser_fill", "file_render", "totp_generate"]
      }
    }
  },
  card: {
    entryType: "card",
    fieldDefinitions: {
      cardholder_name: {
        fieldType: "cardholder_name",
        defaultUseModes: ["browser_fill", "file_render"]
      },
      card_number: {
        fieldType: "card_number",
        defaultUseModes: ["browser_fill", "file_render"]
      },
      expiry_month: {
        fieldType: "expiry_month",
        defaultUseModes: ["browser_fill", "file_render"]
      },
      expiry_year: {
        fieldType: "expiry_year",
        defaultUseModes: ["browser_fill", "file_render"]
      },
      cvv: {
        fieldType: "cvv",
        defaultUseModes: ["browser_fill", "file_render"]
      },
      billing_postal_code: {
        fieldType: "billing_postal_code",
        defaultUseModes: ["browser_fill", "file_render"]
      }
    }
  }
});

function requireEntryType(entryType) {
  const definition = ENTRY_DEFINITIONS[entryType];

  if (!definition) {
    throw new Error(`Unsupported entry type: ${entryType}`);
  }

  return definition;
}

export function createEmptyVault() {
  return {
    version: VAULT_VERSION,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    entries: []
  };
}

export function maskFieldValue(fieldName, value) {
  const stringValue = String(value ?? "");

  if (!stringValue) {
    return "";
  }

  if (fieldName === "card_number") {
    const digits = stringValue.replace(/\D/g, "");
    const suffix = digits.slice(-4) || stringValue.slice(-4);
    return `**** **** **** ${suffix}`;
  }

  if (fieldName === "expiry_month") {
    return "**";
  }

  if (fieldName === "expiry_year") {
    return "****";
  }

  if (fieldName === "cvv") {
    return "***";
  }

  if (fieldName === "totp_seed") {
    return "TOTP configured";
  }

  return maskValue(stringValue);
}

export function getFieldDefinition(entryType, fieldName) {
  const definition = requireEntryType(entryType);
  const fieldDefinition = definition.fieldDefinitions[fieldName];

  if (!fieldDefinition) {
    throw new Error(`Unsupported field ${fieldName} for entry type ${entryType}.`);
  }

  return fieldDefinition;
}

export function fieldNamesForEntryType(entryType) {
  return Object.keys(requireEntryType(entryType).fieldDefinitions);
}

export function createSensitiveField({ entryKey, entryId, fieldName, value, handle, policy, createdAt, updatedAt, lastUsedAt }) {
  const timestamp = createdAt || nowIso();
  const normalizedValue = String(value ?? "");

  if (!normalizedValue) {
    throw new Error(`Field ${fieldName} cannot be empty.`);
  }

  return {
    id: randomId("field_"),
    entryId,
    fieldName,
    fieldType: fieldName,
    handle: handle || createHandle(entryKey, fieldName, 1),
    value: normalizedValue,
    previewMasked: maskFieldValue(fieldName, normalizedValue),
    policy: normalizePolicy(policy, {
      defaultUseModes: getFieldDefinitionFromAny(fieldName).defaultUseModes
    }),
    createdAt: timestamp,
    updatedAt: updatedAt || timestamp,
    lastUsedAt: lastUsedAt || null
  };
}

function getFieldDefinitionFromAny(fieldName) {
  for (const entryType of Object.keys(ENTRY_DEFINITIONS)) {
    const fieldDefinition = ENTRY_DEFINITIONS[entryType].fieldDefinitions[fieldName];

    if (fieldDefinition) {
      return fieldDefinition;
    }
  }

  throw new Error(`Unsupported field type: ${fieldName}`);
}

function entrySummaryShape({ entryType, key, label, site, issuer, notes, tags, createdAt, updatedAt, id, fields }) {
  return {
    id,
    key,
    entryType,
    label,
    site: site || "",
    issuer: issuer || "",
    notes: notes || "",
    tags: normalizeStringList(tags),
    createdAt,
    updatedAt,
    fields
  };
}

export function createEntry({ entryType, key, label, site, issuer, notes, tags, fieldValues = {} }) {
  requireEntryType(entryType);
  const entryId = randomId("entry_");
  const entryKey = normalizeEntryKey(key || site || issuer || label || entryId);
  const timestamp = nowIso();
  const fields = [];

  for (const fieldName of fieldNamesForEntryType(entryType)) {
    const value = trimToUndefined(fieldValues[fieldName]);

    if (!value) {
      continue;
    }

    fields.push(createSensitiveField({
      entryId,
      entryKey,
      fieldName,
      value
    }));
  }

  return entrySummaryShape({
    id: entryId,
    key: entryKey,
    entryType,
    label: trimToUndefined(label) || entryKey,
    site: trimToUndefined(site),
    issuer: trimToUndefined(issuer),
    notes: trimToUndefined(notes),
    tags,
    createdAt: timestamp,
    updatedAt: timestamp,
    fields
  });
}

export function sanitizeField(field) {
  return {
    id: field.id,
    handle: field.handle,
    fieldName: field.fieldName,
    fieldType: field.fieldType,
    previewMasked: field.previewMasked || maskFieldValue(field.fieldName, field.value),
    policy: field.policy,
    createdAt: field.createdAt,
    updatedAt: field.updatedAt,
    lastUsedAt: field.lastUsedAt || null
  };
}

export function sanitizeEntry(entry) {
  return entrySummaryShape({
    ...entry,
    fields: (entry.fields || []).map(sanitizeField),
    expectedFieldNames: fieldNamesForEntryType(entry.entryType)
  });
}

function normalizeEntry(entry) {
  const normalizedType = entry.entryType || "login";
  const normalizedKey = normalizeEntryKey(entry.key || entry.label || entry.site || entry.issuer || entry.id);
  const timestamp = entry.createdAt || nowIso();
  const entryId = entry.id || randomId("entry_");

  return entrySummaryShape({
    id: entryId,
    key: normalizedKey,
    entryType: normalizedType,
    label: trimToUndefined(entry.label) || normalizedKey,
    site: trimToUndefined(entry.site),
    issuer: trimToUndefined(entry.issuer),
    notes: trimToUndefined(entry.notes),
    tags: entry.tags,
    createdAt: timestamp,
    updatedAt: entry.updatedAt || timestamp,
    fields: (entry.fields || []).map((field) => ({
      id: field.id || randomId("field_"),
      entryId: field.entryId || entryId,
      fieldName: field.fieldName || field.name,
      fieldType: field.fieldType || field.fieldName || field.name,
      handle: field.handle || createHandle(normalizedKey, field.fieldName || field.name, 1),
      value: String(field.value ?? ""),
      previewMasked: field.previewMasked || maskFieldValue(field.fieldName || field.name, field.value),
      policy: normalizePolicy(field.policy, {
        defaultUseModes: getFieldDefinitionFromAny(field.fieldName || field.name).defaultUseModes
      }),
      createdAt: field.createdAt || timestamp,
      updatedAt: field.updatedAt || field.createdAt || timestamp,
      lastUsedAt: field.lastUsedAt || null
    }))
  });
}

function migrateVersionOneVault(vault) {
  return {
    version: VAULT_VERSION,
    createdAt: vault.createdAt || nowIso(),
    updatedAt: vault.updatedAt || nowIso(),
    entries: (vault.entries || []).map((entry) => normalizeEntry({
      id: entry.id,
      key: entry.key,
      entryType: "login",
      label: entry.label,
      site: entry.key,
      notes: entry.notes,
      fields: (entry.fields || []).map((field) => ({
        id: field.id,
        fieldName: field.name,
        handle: field.handle,
        value: field.value,
        createdAt: field.createdAt,
        updatedAt: field.updatedAt
      }))
    }))
  };
}

export function normalizeLoadedVault(vault) {
  if (!vault || typeof vault !== "object") {
    throw new Error("Vault data is invalid.");
  }

  if (vault.version === 1) {
    return migrateVersionOneVault(vault);
  }

  if (vault.version !== VAULT_VERSION) {
    throw new Error(`Unsupported vault version: ${vault.version}`);
  }

  return {
    version: VAULT_VERSION,
    createdAt: vault.createdAt || nowIso(),
    updatedAt: vault.updatedAt || nowIso(),
    entries: (vault.entries || []).map((entry) => normalizeEntry(entry))
  };
}
