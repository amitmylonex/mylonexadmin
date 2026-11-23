// Single-instance guard. A shared gateway limiter is required for multi-replica deployments.
const windows = new Map<string, { count: number; resetsAt: number }>();
export function allowAdminWrite(actorId: string, now = Date.now()) {
  for (const [key, value] of windows) if (value.resetsAt <= now) windows.delete(key);
  let window = windows.get(actorId);
  if (!window) {
    if (windows.size >= 10000) return false;
    window = { count: 0, resetsAt: now + 60000 }; windows.set(actorId, window);
  }
  return ++window.count <= 60;
}
