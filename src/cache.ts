// A small in-memory TTL cache, so repeated tool calls don't hit GitHub or Medium every time.

export class TtlCache {
  private entries = new Map<string, { expires: number; value: Promise<unknown> }>()

  constructor(
    private ttlMs: number,
    private now: () => number = Date.now,
  ) {}

  /** The cached value for `key`, or the result of `load` (cached only if it succeeds). */
  get<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.entries.get(key)
    if (hit && hit.expires > this.now()) return hit.value as Promise<T>
    const value = load()
    this.entries.set(key, { expires: this.now() + this.ttlMs, value })
    // A failed request isn't cached; the next call tries again
    value.catch(() => {
      if (this.entries.get(key)?.value === value) this.entries.delete(key)
    })
    return value
  }

  clear(): void {
    this.entries.clear()
  }
}
