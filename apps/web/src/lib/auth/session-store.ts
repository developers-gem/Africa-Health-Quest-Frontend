import type { User } from "@ahq/api-contracts";
import { create } from "zustand";

export type SessionStatus = "unknown" | "anonymous" | "authenticated";

type SessionState = {
  status: SessionStatus;
  /** Kept in memory only — never persisted (the refresh token lives in an httpOnly cookie). */
  accessToken: string | null;
  user: User | null;
  /** Staff sessions must pass a TOTP challenge before staff endpoints work. */
  mfaPending: boolean;
  /** Staff without an authenticator app must set one up before staff endpoints work. */
  mfaSetupRequired: boolean;
  setSession: (accessToken: string, user: User, mfaPending?: boolean) => void;
  setUser: (user: User) => void;
  setMfaPending: (pending: boolean) => void;
  setMfaSetupRequired: (required: boolean) => void;
  clearSession: () => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  status: "unknown",
  accessToken: null,
  user: null,
  mfaPending: false,
  mfaSetupRequired: false,
  setSession: (accessToken, user, mfaPending = false) =>
    set({ status: "authenticated", accessToken, user, mfaPending }),
  setUser: (user) => set({ user }),
  setMfaPending: (mfaPending) => set({ mfaPending }),
  setMfaSetupRequired: (mfaSetupRequired) => set({ mfaSetupRequired }),
  clearSession: () =>
    set({
      status: "anonymous",
      accessToken: null,
      user: null,
      mfaPending: false,
      mfaSetupRequired: false,
    }),
}));
