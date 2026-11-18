import { API_PREFIX, CLIENT_PLATFORM_HEADER, type ClientPlatform } from "@ahq/shared-types";
import type { AuthResponse } from "@ahq/api-contracts";
import { API_BASE_URL } from "@/lib/config";
import { useSessionStore } from "@/lib/auth/session-store";
import { ApiError, toApiError } from "./errors";

const PLATFORM: ClientPlatform = "web";

type Query = Record<string, string | number | boolean | null | undefined>;
type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  /** Raw request body (file uploads); sent as-is with its own content type. */
  rawBody?: Blob;
  query?: Query;
  /** Attach the access token and transparently refresh it once on 401. Default true. */
  auth?: boolean;
  /** Send an Idempotency-Key so a retried reward-bearing request is applied at most once. */
  idempotent?: boolean;
};

export function buildUrl(path: string, query?: Query) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const s = qs.toString();
  return `${API_BASE_URL}${path}${s ? `?${s}` : ""}`;
}

async function rawFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      credentials: "include", // sends the httpOnly refresh cookie to /api/v1/auth/*
      headers: { [CLIENT_PLATFORM_HEADER]: PLATFORM, ...init.headers },
    });
  } catch {
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "Can't reach the server. Check your connection and try again.",
    );
  }
}

let refreshInFlight: Promise<boolean> | null = null;

/** Stores the session returned by login/refresh/MFA endpoints. */
export function applyAuthResponse(data: AuthResponse) {
  useSessionStore.getState().setSession(data.accessToken, data.user, Boolean(data.mfaRequired));
}

/**
 * Rotates the refresh cookie and stores a new access token. Single-flight within the tab and, where the
 * Web Locks API exists, across tabs — concurrent rotation of the same token is treated as theft by the API.
 */
export function refreshSession(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    const run = async () => {
      const res = await rawFetch(buildUrl(`${API_PREFIX}/auth/refresh`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) {
        useSessionStore.getState().clearSession();
        return false;
      }
      applyAuthResponse((await res.json()) as AuthResponse);
      return true;
    };
    try {
      return typeof navigator !== "undefined" && navigator.locks
        ? await navigator.locks.request("ahq-refresh", run)
        : await run();
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, rawBody, query, auth = true, idempotent, headers, ...rest } = options;
  const idempotencyKey = idempotent ? crypto.randomUUID() : undefined;
  const url = buildUrl(path, query);
  const send = () => {
    const token = auth ? useSessionStore.getState().accessToken : null;
    return rawFetch(url, {
      ...rest,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(rawBody ? { "Content-Type": rawBody.type || "application/octet-stream" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        ...(headers as Record<string, string> | undefined),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : rawBody ? { body: rawBody } : {}),
    });
  };

  let res = await send();
  if (res.status === 401 && auth && useSessionStore.getState().accessToken) {
    const err = await toApiError(res.clone());
    // MFA and step-up errors are also 401 but must not trigger a refresh.
    if (err.code === "UNAUTHENTICATED" || err.code === "TOKEN_INVALID") {
      if (await refreshSession()) res = await send();
    } else {
      if (err.code === "MFA_REQUIRED") {
        const store = useSessionStore.getState();
        if (err.detail("mfa") === "setup_required") store.setMfaSetupRequired(true);
        else store.setMfaPending(true);
      }
      throw err;
    }
  }
  if (!res.ok) {
    const err = await toApiError(res);
    if (err.code === "MFA_REQUIRED") {
      const store = useSessionStore.getState();
      if (err.detail("mfa") === "setup_required") store.setMfaSetupRequired(true);
      else store.setMfaPending(true);
    }
    throw err;
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Downloads a protected file (e.g. private clinician evidence) as an object URL. */
export async function apiBlobUrl(path: string): Promise<string> {
  const token = useSessionStore.getState().accessToken;
  const res = await rawFetch(buildUrl(path), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw await toApiError(res);
  return URL.createObjectURL(await res.blob());
}

/** Absolute URL for public media paths returned by the API ("/media/:id"). */
export function mediaUrl(path: string | null | undefined) {
  if (!path) return null;
  return path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
}
