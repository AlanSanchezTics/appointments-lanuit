export function normalizeClientName(value: string) {
  return value.trim();
}

export function areEquivalentClientNames(left: string, right: string) {
  return normalizeClientName(left) === normalizeClientName(right);
}
