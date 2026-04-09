function sortByDescendingLength(values) {
  return [...values].sort((left, right) => right.length - left.length);
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

  let output = text;
  const handles = sortByDescendingLength(handleMap.keys());

  for (const handle of handles) {
    output = output.split(handle).join(handleMap.get(handle));
  }

  return output;
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
