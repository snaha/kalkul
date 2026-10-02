/** A value with object keys in a fixed order, so equal content serialises alike. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
    )
  }
  return value
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))
}

/**
 * The fields of `next` whose value differs from `seed`.
 *
 * A form that is filled in when it opens and saved later should write only
 * what the user changed: writing its other fields too would put back the
 * values they had when the form opened, undoing a change made meanwhile
 * elsewhere (another tab, an MCP tool). Pass what the save would have
 * written right when the form opened as `seed`, and what it would write now
 * as `next`. A field cleared since (`undefined` now) is kept, so the
 * clearing is saved.
 */
export function changedFields<T extends object>(seed: T, next: T): Partial<T> {
  const keys = new Set([...Object.keys(seed), ...Object.keys(next)]) as Set<keyof T>
  const changed: Partial<T> = {}
  for (const key of keys) {
    if (!same(seed[key], next[key])) changed[key] = next[key]
  }
  return changed
}
