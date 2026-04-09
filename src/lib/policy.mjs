import { normalizeStringList } from "./util.mjs";

export const USE_MODES = Object.freeze([
  "browser_fill",
  "file_render",
  "totp_generate"
]);

function normalizeUseModes(values, defaultUseModes = []) {
  const normalized = normalizeStringList(values && values.length ? values : defaultUseModes)
    .filter((value) => USE_MODES.includes(value));

  return normalized.length ? normalized : [...defaultUseModes];
}

export function normalizeOrigin(origin) {
  if (!origin) {
    return undefined;
  }

  try {
    return new URL(String(origin)).origin;
  } catch {
    return undefined;
  }
}

export function normalizePolicy(policy, { defaultUseModes = [] } = {}) {
  const allowedOrigins = normalizeStringList(policy?.allowedOrigins).map((origin) => normalizeOrigin(origin)).filter(Boolean);

  return {
    disabled: Boolean(policy?.disabled),
    allowedUseModes: normalizeUseModes(policy?.allowedUseModes, defaultUseModes),
    allowedOrigins
  };
}

export function checkFieldPolicy(field, { useMode, origin } = {}) {
  const normalizedOrigin = useMode === "browser_fill" ? normalizeOrigin(origin) : undefined;
  const policy = normalizePolicy(field.policy, {
    defaultUseModes: field.policy?.allowedUseModes || []
  });

  if (policy.disabled) {
    return {
      allowed: false,
      reason: "This field is disabled."
    };
  }

  if (!policy.allowedUseModes.includes(useMode)) {
    return {
      allowed: false,
      reason: `Use mode ${useMode} is not allowed for this field.`
    };
  }

  if (useMode === "browser_fill") {
    if (!normalizedOrigin) {
      return {
        allowed: false,
        reason: "A valid origin is required for browser fills."
      };
    }

    if (policy.allowedOrigins.length > 0 && !policy.allowedOrigins.includes(normalizedOrigin)) {
      return {
        allowed: false,
        reason: `Origin ${normalizedOrigin} is not allowed for this field.`
      };
    }
  }

  return {
    allowed: true,
    normalizedOrigin
  };
}
