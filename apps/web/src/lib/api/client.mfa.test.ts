import { afterEach, describe, expect, it, vi } from "vitest";
import { useSessionStore } from "@/lib/auth/session-store";
import { json, signIn } from "@/test/render";
import { apiFetch } from "./client";

afterEach(() => vi.unstubAllGlobals());

describe("MFA and step-up errors", () => {
  it("flags MFA setup or challenge without trying to refresh the session", async () => {
    signIn({ roles: ["player", "admin"] });
    const fetchMock = vi.fn().mockResolvedValue(
      json(401, {
        error: {
          code: "MFA_REQUIRED",
          message: "Set up",
          details: [{ path: "mfa", message: "setup_required" }],
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(apiFetch("/api/v1/admin/users")).rejects.toMatchObject({ code: "MFA_REQUIRED" });
    expect(fetchMock).toHaveBeenCalledTimes(1); // no refresh attempt
    expect(useSessionStore.getState().mfaSetupRequired).toBe(true);
    expect(useSessionStore.getState().status).toBe("authenticated");

    fetchMock.mockResolvedValue(
      json(401, {
        error: {
          code: "MFA_REQUIRED",
          message: "Code",
          details: [{ path: "mfa", message: "challenge_required" }],
        },
      }),
    );
    await expect(apiFetch("/api/v1/admin/users")).rejects.toBeTruthy();
    expect(useSessionStore.getState().mfaPending).toBe(true);
  });

  it("sends an Idempotency-Key for reward-bearing requests", async () => {
    signIn();
    const fetchMock = vi.fn().mockResolvedValue(json(201, {}));
    vi.stubGlobal("fetch", fetchMock);
    await apiFetch("/api/v1/hospital/runs", { method: "POST", body: {}, idempotent: true });
    expect(fetchMock.mock.calls[0]![1].headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
  });
});
