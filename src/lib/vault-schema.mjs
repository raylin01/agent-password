import { normalizePolicy } from "./policy.mjs";
import { createHandle, maskValue, normalizeEntryKey, normalizeStringList, nowIso, randomId, trimToUndefined } from "./util.mjs";

export const VAULT_VERSION = 3;

const DEFAULT_SECRET_USE_MODES = Object.freeze(["browser_fill", "file_render"]);
const TOTP_USE_MODES = Object.freeze(["browser_fill", "file_render", "totp_generate"]);

const ENTRY_DEFINITIONS = Object.freeze({
  login: {
    entryType: "login",
    freeformFields: false,
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
        defaultUseModes: [...TOTP_USE_MODES]
      }
    }
  },
  card: {
    entryType: "card",
    freeformFields: false,
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
  },
  secret: {
    entryType: "secret",
    freeformFields: true,
    fieldDefinitions: {}
  }
});

function requireEntryType(entryType) {
  const definition = ENTRY_DEFINITIONS[entryType];

  if (!definition) {
    throw new Error(`Unsupported entry type: ${entryType}`);
  }

  return definition;
}

function defaultFieldDefinition(fieldName) {
  const normalizedFieldName = String(fieldName || "").trim();

  if (!normalizedFieldName) {
    throw new Error("Field name cannot be empty.");
  }

  if (normalizedFieldName === "totp_seed") {
    return {
      fieldType: normalizedFieldName,
      defaultUseModes: [...TOTP_USE_MODES]
    };
  }

  return {
    fieldType: normalizedFieldName,
    defaultUseModes: [...DEFAULT_SECRET_USE_MODES]
  };
}

function getFieldDefinitionFromEntry(entryType, fieldName) {
  const definition = requireEntryType(entryType);
  const fieldDefinition = definition.fieldDefinitions[fieldName];

  if (fieldDefinition) {
    return fieldDefinition;
  }

  if (definition.freeformFields) {
    return defaultFieldDefinition(fieldName);
  }

  throw new Error(`Unsupported field ${fieldName} for entry type ${entryType}.`);
}

function getFieldDefinitionFromAny(fieldName) {
  for (const entryType of Object.keys(ENTRY_DEFINITIONS)) {
    const definition = ENTRY_DEFINITIONS[entryType];
    const fieldDefinition = definition.fieldDefinitions[fieldName];

    if (fieldDefinition) {
      return fieldDefinition;
    }
  }

  return defaultFieldDefinition(fieldName);
}

function normalizeSecretFieldName(fieldName) {
  const normalized = String(fieldName ?? "").trim();

  if (!normalized) {
    throw new Error("Field name cannot be empty.");
  }

  return normalized;
}

export function createEmptyVault() {
  const timestamp = nowIso();

  return {
    version: VAULT_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
    entries: []
  };
}

export function isFreeformEntryType(entryType) {
  return Boolean(requireEntryType(entryType).freeformFields);
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
  return getFieldDefinitionFromEntry(entryType, fieldName);
}

export function fieldNamesForEntryType(entryType) {
  return Object.keys(requireEntryType(entryType).fieldDefinitions);
}

export function createSensitiveField({ entryType = "secret", entryKey, entryId, fieldName, value, handle, policy, createdAt, updatedAt, lastUsedAt }) {
  const timestamp = createdAt || nowIso();
  const normalizedFieldName = isFreeformEntryType(entryType)
    ? normalizeSecretFieldName(fieldName)
    : fieldName;
  const normalizedValue = String(value ?? "");

  if (!normalizedValue) {
    throw new Error(`Field ${normalizedFieldName} cannot be empty.`);
  }

  const fieldDefinition = getFieldDefinitionFromEntry(entryType, normalizedFieldName);

  return {
    id: randomId("field_"),
    entryId,
    fieldName: normalizedFieldName,
    fieldType: fieldDefinition.fieldType || normalizedFieldName,
    handle: handle || createHandle(entryKey, normalizedFieldName, 1),
    value: normalizedValue,
    previewMasked: maskFieldValue(normalizedFieldName, normalizedValue),
    policy: normalizePolicy(policy, {
      defaultUseModes: fieldDefinition.defaultUseModes
    }),
    createdAt: timestamp,
    updatedAt: updatedAt || timestamp,
    lastUsedAt: lastUsedAt || null
  };
}

function entrySummaryShape({ entryType, key, label, site, issuer, provider, notes, tags, createdAt, updatedAt, id, fields, expectedFieldNames }) {
  return {
    id,
    key,
    entryType,
    label,
    site: site || "",
    issuer: issuer || "",
    provider: provider || "",
    notes: notes || "",
    tags: normalizeStringList(tags),
    createdAt,
    updatedAt,
    fields,
    expectedFieldNames
  };
}

function createSecretFields(entryId, entryKey, fields = []) {
  const normalizedFields = [];

  for (const field of fields) {
    const fieldName = normalizeSecretFieldName(field?.fieldName || field?.name);
    const value = trimToUndefined(field?.value);

    if (!value) {
      continue;
    }

    normalizedFields.push(createSensitiveField({
      entryType: "secret",
      entryId,
      entryKey,
      fieldName,
      value,
      policy: field.policy
    }));
  }

  return normalizedFields;
}

export function createEntry({ entryType, key, label, site, issuer, provider, notes, tags, fieldValues = {}, fields = [] }) {
  requireEntryType(entryType);
  const entryId = randomId("entry_");
  const entryKey = normalizeEntryKey(key || label || site || issuer || provider || entryId);
  const timestamp = nowIso();
  const entryLabel = trimToUndefined(label) || entryKey;
  const entryFields = isFreeformEntryType(entryType)
    ? createSecretFields(entryId, entryKey, fields)
    : fieldNamesForEntryType(entryType).flatMap((fieldName) => {
      const value = trimToUndefined(fieldValues[fieldName]);

      if (!value) {
        return [];
      }

      return [createSensitiveField({
        entryType,
        entryId,
        entryKey,
        fieldName,
        value
      })];
    });

  return entrySummaryShape({
    id: entryId,
    key: entryKey,
    entryType,
    label: entryLabel,
    site: trimToUndefined(site),
    issuer: trimToUndefined(issuer),
    provider: trimToUndefined(provider),
    notes: trimToUndefined(notes),
    tags,
    createdAt: timestamp,
    updatedAt: timestamp,
    fields: entryFields,
    expectedFieldNames: isFreeformEntryType(entryType) ? [] : fieldNamesForEntryType(entryType)
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
    expectedFieldNames: isFreeformEntryType(entry.entryType) ? [] : fieldNamesForEntryType(entry.entryType)
  });
}

function normalizeEntry(entry) {
  const normalizedType = entry.entryType || "login";
  requireEntryType(normalizedType);
  const normalizedKey = normalizeEntryKey(entry.key || entry.label || entry.site || entry.issuer || entry.provider || entry.id);
  const timestamp = entry.createdAt || nowIso();
  const entryId = entry.id || randomId("entry_");

  return entrySummaryShape({
    id: entryId,
    key: normalizedKey,
    entryType: normalizedType,
    label: trimToUndefined(entry.label) || normalizedKey,
    site: trimToUndefined(entry.site),
    issuer: trimToUndefined(entry.issuer),
    provider: trimToUndefined(entry.provider),
    notes: trimToUndefined(entry.notes),
    tags: entry.tags,
    createdAt: timestamp,
    updatedAt: entry.updatedAt || timestamp,
    fields: (entry.fields || [])
      .map((field) => {
        const fieldName = isFreeformEntryType(normalizedType)
          ? normalizeSecretFieldName(field.fieldName || field.name)
          : field.fieldName || field.name;

        return {
          id: field.id || randomId("field_"),
          entryId: field.entryId || entryId,
          fieldName,
          fieldType: field.fieldType || getFieldDefinitionFromEntry(normalizedType, fieldName).fieldType,
          handle: field.handle || createHandle(normalizedKey, fieldName, 1),
          value: String(field.value ?? ""),
          previewMasked: field.previewMasked || maskFieldValue(fieldName, field.value),
          policy: normalizePolicy(field.policy, {
            defaultUseModes: getFieldDefinitionFromEntry(normalizedType, fieldName).defaultUseModes
          }),
          createdAt: field.createdAt || timestamp,
          updatedAt: field.updatedAt || field.createdAt || timestamp,
          lastUsedAt: field.lastUsedAt || null
        };
      })
      .filter((field) => field.value),
    expectedFieldNames: isFreeformEntryType(normalizedType) ? [] : fieldNamesForEntryType(normalizedType)
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

function migrateVersionTwoVault(vault) {
  return {
    version: VAULT_VERSION,
    createdAt: vault.createdAt || nowIso(),
    updatedAt: vault.updatedAt || nowIso(),
    entries: (vault.entries || []).map((entry) => normalizeEntry(entry))
  };
}

export function normalizeLoadedVault(vault) {
  if (!vault || typeof vault !== "object") {
    throw new Error("Vault data is invalid.");
  }

  if (vault.version === 1) {
    return migrateVersionOneVault(vault);
  }

  if (vault.version === 2) {
    return migrateVersionTwoVault(vault);
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
