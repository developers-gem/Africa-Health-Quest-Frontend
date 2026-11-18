import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionStore } from "@/lib/auth/session-store";
import { apiFetch, refreshSession } from "./client";
import { ApiError } from "./errors";

const user = {
  id: "u1",
  email: null,
  displayName: "Guest healer",
  roles: ["player"],
  emailVerified: false,
  isGuest: true,
  createdAt: "2026-11-03T00:00:00.000Z",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const unauthenticated = () => json(401, { error: { code: "UNAUTHENTICATED", message: "expired" } });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  useSessionStore.setState({
    status: "authenticated",
    accessToken: "old-token",
    user: user as never,
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("apiFetch", () => {
  it("sends the bearer token, platform header and cookies", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }));
    await apiFetch("/api/v1/users/me");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://localhost:4000/api/v1/users/me");
    expect(init.headers.Authorization).toBe("Bearer old-token");
    expect(init.headers["x-client-platform"]).toBe("web");
    expect(init.credentials).toBe("include");
  });

  it("refreshes once on 401 and retries with the new token", async () => {
    fetchMock
      .mockResolvedValueOnce(unauthenticated())
      .mockResolvedValueOnce(
        json(200, { accessToken: "new-token", accessTokenExpiresIn: 900, user }),
      )
      .mockResolvedValueOnce(json(200, { id: "u1" }));
    await expect(apiFetch("/api/v1/users/me")).resolves.toEqual({ id: "u1" });
    expect(fetchMock.mock.calls[1]![0]).toBe("http://localhost:4000/api/v1/auth/refresh");
    expect(fetchMock.mock.calls[2]![1].headers.Authorization).toBe("Bearer new-token");
  });

  it("makes a single refresh call for concurrent 401s", async () => {
    let releaseRefresh!: () => void;
    const refreshGate = new Promise<void>((r) => (releaseRefresh = r));
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (url.endsWith("/auth/refresh")) {
        await refreshGate;
        return json(200, { accessToken: "new-token", accessTokenExpiresIn: 900, user });
      }
      const auth = (init.headers as Record<string, string>).Authorization;
      return auth === "Bearer new-token" ? json(200, { ok: true }) : unauthenticated();
    });
    const all = Promise.all([apiFetch("/a"), apiFetch("/b"), apiFetch("/c")]);
    await new Promise((r) => setTimeout(r, 10));
    releaseRefresh();
    await all;
    expect(fetchMock.mock.calls.filter(([u]) => String(u).endsWith("/auth/refresh"))).toHaveLength(
      1,
    );
  });

  it("clears the session when refresh fails", async () => {
    fetchMock.mockResolvedValueOnce(unauthenticated());
    await expect(refreshSession()).resolves.toBe(false);
    expect(useSessionStore.getState()).toMatchObject({ status: "anonymous", accessToken: null });
  });

  it("maps the API error envelope to ApiError", async () => {
    fetchMock.mockResolvedValueOnce(
      json(400, {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request body.",
          details: [{ path: "email", message: "bad" }],
          requestId: "r1",
        },
      }),
    );
    const err = (await apiFetch("/x", { auth: false }).catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 400, code: "VALIDATION_ERROR", requestId: "r1" });
    expect(err.details).toEqual([{ path: "email", message: "bad" }]);
  });

  it("reports network failures as NETWORK_ERROR", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(apiFetch("/x", { auth: false })).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      status: 0,
    });
  });
});
