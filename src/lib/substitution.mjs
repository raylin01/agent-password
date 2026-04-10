function sortByDescendingLength(values) {
  return [...values].sort((left, right) => right.length - left.length);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createHandlePattern(handles) {
  const parts = sortByDescendingLength([...handles]).map((handle) => escapeRegExp(handle));

  if (!parts.length) {
    return null;
  }

  const alternation = parts.join("|");
  return new RegExp(`{{\\s*(${alternation})\\s*}}|(${alternation})`, "g");
}

export function buildHandleMap(vault) {
  const map = new Map();

  for (const entry of vault.entries || []) {
    for (const field of entry.fields || []) {
      map.set(field.handle, String(field.value ?? ""));
    }
  }

  return map;
}

export function replaceHandles(text, handleMap) {
  if (typeof text !== "string" || text.length === 0) {
    return text;
  }

  const pattern = createHandlePattern(handleMap.keys());

  if (!pattern) {
    return text;
  }

  return text.replace(pattern, (match, wrappedHandle, bareHandle) => {
    const handle = wrappedHandle || bareHandle;
    return handleMap.get(handle) ?? match;
  });
}

export function replaceHandlesInArray(values, handleMap) {
  return values.map((value) => replaceHandles(value, handleMap));
}

export function replaceHandlesInEnv(env, handleMap) {
  const output = {};

  for (const [key, value] of Object.entries(env || {})) {
    output[key] = typeof value === "string" ? replaceHandles(value, handleMap) : value;
  }

  return output;
}

export function redactSecrets(text, handleMap) {
  if (typeof text !== "string" || text.length === 0) {
    return text;
  }

  let output = text;
  const secretPairs = [...handleMap.entries()]
    .filter(([, value]) => value)
    .sort((left, right) => right[1].length - left[1].length);

  for (const [handle, secret] of secretPairs) {
    output = output.split(secret).join(handle);
  }

  return output;
}
