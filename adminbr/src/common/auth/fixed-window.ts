/** Insertion-ordered expiry: expired entries are visited once, not per request. */
export function createFixedWindow(limit: number, windowMs = 60_000, maxKeys = 10_000) {
  const windows = new Map<string, { count: number; until: number }>();
  return (key: string, now = Date.now()) => {
    for (const [oldKey, value] of windows) {
      if (value.until > now) break;
      windows.delete(oldKey);
    }
    let value = windows.get(key);
    if (!value) {
      if (windows.size >= maxKeys) return false;
      value = { count: 0, until: now + windowMs };
      windows.set(key, value);
    }
    return ++value.count <= limit;
  };
}
