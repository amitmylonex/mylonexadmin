const codes: Record<number, string> = {
  400: "BAD_REQUEST", 401: "UNAUTHENTICATED", 403: "FORBIDDEN", 404: "NOT_FOUND",
  409: "CONFLICT", 413: "PAYLOAD_TOO_LARGE", 429: "RATE_LIMITED", 500: "INTERNAL_ERROR", 503: "SERVICE_UNAVAILABLE",
};
export function apiError(status: number, message: string, code = codes[status] || "REQUEST_FAILED", details: unknown = null) {
  return { success: false as const, error: { code, message, details } };
}
