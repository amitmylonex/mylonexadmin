export class ApiError extends Error {
  constructor(message: string, public status = 0, public code = "NETWORK_ERROR", public details: unknown = null,
    public requestId?: string, public conflict?: unknown, public currentStatus?: unknown) { super(message); }
}
type Dependencies = {
  baseUrl: string;
  getToken: () => Promise<string | undefined>;
  onUnauthorized: () => void | Promise<void>;
  onError: (error: ApiError) => void;
  fetch?: typeof fetch;
};
export type ApiRequestOptions = RequestInit & { responseType?: "json" | "blob" };
export function createApiClient(deps: Dependencies) {
  return async function request<T = any>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    // Credentials are only sent to the configured API, never a caller-supplied URL.
    if (!path.startsWith("/") || path.startsWith("//")) throw new Error("API path must be relative to the configured backend");
    let reported = false;
    try {
      const token = await deps.getToken();
      const headers = new Headers(options.headers);
      if (options.body !== undefined && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const { responseType, ...fetchOptions } = options;
      const response = await (deps.fetch || fetch)(`${deps.baseUrl.replace(/\/$/, "")}${path}`, { ...fetchOptions, headers });
      if (response.ok && responseType === "blob") return await response.blob() as T;
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) {
        const body = data.error;
        const error = new ApiError(typeof body === "string" ? body : body?.message || "Request failed",
          response.status, body?.code || "REQUEST_FAILED", body?.details ?? null, data.requestId || response.headers.get("X-Request-Id") || undefined,
          data.conflict, data.currentStatus);
        if (response.status === 401) {
          // Redirecting unmounts the caller and may abort its signal. Report the
          // expiry first so that cleanup cannot suppress the login notification.
          deps.onError(error); reported = true;
          await deps.onUnauthorized();
        }
        throw error;
      }
      return data;
    } catch (failure) {
      if (options.signal?.aborted || (failure instanceof Error && failure.name === "AbortError")) throw failure;
      const error = failure instanceof ApiError ? failure : new ApiError("Could not connect to the Admin API. Please retry.");
      if (!reported) deps.onError(error);
      throw error;
    }
  };
}
