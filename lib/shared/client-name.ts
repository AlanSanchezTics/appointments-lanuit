export function normalizeClientName(value: string) {
  return value.trim();
}

export function normalizeClientAlias(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function areEquivalentClientNames(left: string, right: string) {
  return normalizeClientName(left) === normalizeClientName(right);
}

export function resolveClientDisplayName(input: {
  name: string;
  alias?: string | null;
}, splitName = false) {
  const normalizedAlias = normalizeClientAlias(input.alias);
  return normalizedAlias ?? (splitName ? input.name.split(" ")[0] : input.name);
}
