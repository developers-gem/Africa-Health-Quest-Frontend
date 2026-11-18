import { API_PREFIX } from "@ahq/shared-types";
import type { AuthResponse, GuestUpgradeResponse, User } from "@ahq/api-contracts";
import { useSessionStore } from "@/lib/auth/session-store";
import { apiFetch, applyAuthResponse } from "./client";
import type { SessionSummary } from "./types";

const A = `${API_PREFIX}/auth`;
type Msg = { message: string };

export const authApi = {
  register: (body: { email: string; password: string; displayName: string }) =>
    apiFetch<Msg>(`${A}/register`, { method: "POST", body, auth: false }),
  verifyEmail: (token: string) =>
    apiFetch<Msg>(`${A}/verify-email`, { method: "POST", body: { token }, auth: false }),
  resendVerification: (email: string) =>
    apiFetch<Msg>(`${A}/resend-verification`, { method: "POST", body: { email }, auth: false }),
  async login(body: { email: string; password: string }) {
    const data = await apiFetch<AuthResponse>(`${A}/login`, { method: "POST", body, auth: false });
    applyAuthResponse(data);
    return data;
  },
  async google(idToken: string) {
    const data = await apiFetch<AuthResponse>(`${A}/google`, {
      method: "POST",
      body: { idToken },
      auth: false,
    });
    applyAuthResponse(data);
    return data;
  },
  async upgradeGuest(body: { email: string; password: string; displayName: string }) {
    const data = await apiFetch<GuestUpgradeResponse>(`${A}/guest/upgrade`, {
      method: "POST",
      body,
    });
    useSessionStore.getState().setUser(data.user);
    return data;
  },
  forgotPassword: (email: string) =>
    apiFetch<Msg>(`${A}/forgot-password`, { method: "POST", body: { email }, auth: false }),
  resetPassword: (body: { token: string; password: string }) =>
    apiFetch<Msg>(`${A}/reset-password`, { method: "POST", body, auth: false }),
  sessions: () => apiFetch<{ items: SessionSummary[] }>(`${A}/sessions`),
  revokeSession: (id: string) => apiFetch<void>(`${A}/sessions/${id}`, { method: "DELETE" }),
  async logoutAll() {
    await apiFetch<void>(`${A}/logout-all`, { method: "POST", body: {} });
    useSessionStore.getState().clearSession();
  },
  reauthenticate: (password: string) =>
    apiFetch<{ authenticatedAt: string }>(`${A}/reauthenticate`, {
      method: "POST",
      body: { password },
    }),
  mfaSetup: () =>
    apiFetch<{ secret: string; otpauthUri: string }>(`${A}/mfa/totp/setup`, {
      method: "POST",
      body: {},
    }),
  /** Confirms TOTP setup and returns the one-time recovery codes. Call finishMfaEnrollment once they're saved. */
  mfaVerify: (code: string) =>
    apiFetch<{ recoveryCodes: string[] }>(`${A}/mfa/totp/verify`, {
      method: "POST",
      body: { code },
    }),
  /** Marks the session as MFA-verified locally (after the user has saved their recovery codes). */
  finishMfaEnrollment() {
    const store = useSessionStore.getState();
    store.setMfaPending(false);
    store.setMfaSetupRequired(false);
    if (store.user) store.setUser({ ...store.user, mfaEnabled: true });
  },
  async mfaChallenge(body: { code?: string; recoveryCode?: string }) {
    const res = await apiFetch<unknown>(`${A}/mfa/challenge`, { method: "POST", body });
    useSessionStore.getState().setMfaPending(false);
    return res;
  },
  disableMfa: () => apiFetch<void>(`${A}/mfa`, { method: "DELETE" }),
  async updateMe(displayName: string) {
    const user = await apiFetch<User>(`${API_PREFIX}/users/me`, {
      method: "PATCH",
      body: { displayName },
    });
    useSessionStore.getState().setUser(user);
    return user;
  },
};
