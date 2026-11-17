/** Aceita lista ou JSON em texto (o insert antigo gravava a lista como string jsonb). */
export function asStringArray(value: unknown, depth = 0): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (typeof value === 'string' && depth < 2) {
    try {
      return asStringArray(JSON.parse(value), depth + 1);
    } catch {
      return [];
    }
  }
  return [];
}
