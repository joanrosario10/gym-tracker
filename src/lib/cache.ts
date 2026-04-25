// Tiny in-memory stale-while-revalidate cache.
// Per browser tab; cleared on refresh.

interface Entry<T> {
  data: T
  ts: number
}

const store = new Map<string, Entry<unknown>>()

export function cacheGet<T>(key: string, maxAgeMs: number): T | null {
  const entry = store.get(key) as Entry<T> | undefined
  if (!entry) return null
  if (Date.now() - entry.ts > maxAgeMs) return null
  return entry.data
}

export function cacheStale<T>(key: string): T | null {
  const entry = store.get(key) as Entry<T> | undefined
  return entry ? entry.data : null
}

export function cacheSet<T>(key: string, data: T): void {
  store.set(key, { data, ts: Date.now() })
}

export function cacheInvalidate(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}
