export class AdminSessionError extends Error {
  constructor(public statusCode: number, message: string, public code?: string) { super(message); }
}
export async function resolveAdminSession(token: string, auth: { getUser: (token: string) => Promise<any> }, users: { findUnique: (query: any) => Promise<any> }) {
  const { data, error } = await auth.getUser(token);
  if (error && (error.status >= 500 || error.name === "AuthRetryableFetchError")) throw new AdminSessionError(503, "Authentication provider unavailable. Retry shortly.");
  if (error || !data?.user?.id) throw new AdminSessionError(401, "Invalid or expired session token");
  let user;
  try {
    user = await users.findUnique({ where: { id: data.user.id }, select: { id: true, email: true, fullName: true, role: true } });
  } catch {
    throw new AdminSessionError(503, "The database is temporarily unavailable. Admin access could not be verified. Please retry shortly.", "ADMIN_ROLE_LOOKUP_UNAVAILABLE");
  }
  if (!user || user.role !== "ADMIN") throw new AdminSessionError(403, "Forbidden: Admin privileges required");
  return user;
}
