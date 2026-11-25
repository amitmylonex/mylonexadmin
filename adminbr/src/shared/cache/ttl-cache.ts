/** Non-authoritative cache; a future Redis adapter can implement this interface. */
export interface CacheStore {
  remember<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T>;
  clear(): void;
}
export class MemoryCache implements CacheStore {
  private entries = new Map<string, { until: number; value: Promise<unknown> }>();
  constructor(private maxEntries = 100, private now = Date.now) {}
  remember<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
    const existing = this.entries.get(key);
    if (existing && existing.until > this.now()) return existing.value as Promise<T>;
    if (!existing && this.entries.size >= this.maxEntries) this.entries.delete(this.entries.keys().next().value!);
    const entry = { until: Infinity, value: Promise.resolve().then(load) };
    this.entries.set(key, entry);
    entry.value.then(() => { entry.until = this.now() + ttlMs; }, () => {
      if (this.entries.get(key) === entry) this.entries.delete(key);
    });
    return entry.value;
  }
  clear() { this.entries.clear(); }
}
