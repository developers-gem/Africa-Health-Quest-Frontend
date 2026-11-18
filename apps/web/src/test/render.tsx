import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { vi } from "vitest";
import { useSessionStore } from "@/lib/auth/session-store";

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Routes fetch calls by "METHOD path" (query string ignored) to canned responses; records every call. */
export function mockApi(
  routes: Record<string, (body: unknown, url: string) => Response | Promise<Response>>,
) {
  const calls: { method: string; path: string; body: unknown }[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const u = new URL(url);
    const method = (init?.method ?? "GET").toUpperCase();
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    calls.push({ method, path: u.pathname, body });
    const handler = routes[`${method} ${u.pathname}`];
    if (!handler)
      return json(404, {
        error: { code: "NOT_FOUND", message: `unmocked ${method} ${u.pathname}` },
      });
    return handler(body, url);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls, fetchMock };
}

export function signIn(user: Partial<import("@ahq/api-contracts").User> = {}) {
  useSessionStore.setState({
    status: "authenticated",
    accessToken: "token",
    mfaPending: false,
    mfaSetupRequired: false,
    user: {
      id: "u1",
      email: "p@example.com",
      displayName: "Pat Player",
      roles: ["player"],
      emailVerified: true,
      isGuest: false,
      mfaEnabled: false,
      suspended: false,
      createdAt: "2026-11-01T00:00:00.000Z",
      ...user,
    },
  });
}

export function renderRoute(
  element: ReactNode,
  { path = "/", url = "/" }: { path?: string; url?: string } = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path, element },
      { path: "*", element: <div>navigated</div> },
    ],
    { initialEntries: [url] },
  );
  return {
    router,
    client,
    ...render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
  };
}
