import { API_PREFIX } from "@ahq/shared-types";
import type { AuthResponse, HealthResponse, User } from "@ahq/api-contracts";
import { useSessionStore } from "@/lib/auth/session-store";
import { apiFetch, applyAuthResponse } from "./client";

export const getHealth = () => apiFetch<HealthResponse>("/health", { auth: false });
export const getReadiness = () => apiFetch<HealthResponse>("/ready", { auth: false });
export const getMe = () => apiFetch<User>(`${API_PREFIX}/users/me`);

export async function startGuestSession(): Promise<User> {
  const data = await apiFetch<AuthResponse>(`${API_PREFIX}/auth/guest`, {
    method: "POST",
    body: {},
    auth: false,
  });
  applyAuthResponse(data);
  return data.user;
}

export async function signOut(): Promise<void> {
  try {
    await apiFetch(`${API_PREFIX}/auth/logout`, { method: "POST", body: {}, auth: false });
  } finally {
    useSessionStore.getState().clearSession();
  }
}
