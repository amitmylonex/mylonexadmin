const windows = new Map<string, { count: number; until: number }>();
export function allowAuthVerification(ip: string, now = Date.now()) {
  for (const [key, value] of windows)
    if (value.until <= now) windows.delete(key);
  let window = windows.get(ip);
  if (!window) {
    if (windows.size >= 10000) return false;
    window = { count: 0, until: now + 60000 };
    windows.set(ip, window);
  }
  return ++window.count <= 300;
}
