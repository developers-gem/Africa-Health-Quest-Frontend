import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionStore } from "@/lib/auth/session-store";
import { SetupStatusPage } from "./SetupStatusPage";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const guestUser = {
  id: "665f1c2e9b1d8a0012345678",
  email: null,
  displayName: "Guest healer",
  roles: ["player"],
  emailVerified: false,
  isGuest: true,
  createdAt: "2026-11-03T00:00:00.000Z",
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SetupStatusPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => useSessionStore.setState({ status: "anonymous", accessToken: null, user: null }));

describe("SetupStatusPage", () => {
  it("shows API and database status and starts a guest session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/health")) return json(200, { status: "ok", version: "0.1.0" });
        if (url.endsWith("/ready"))
          return json(200, { status: "ok", version: "0.1.0", database: "up" });
        if (url.endsWith("/auth/guest"))
          return json(201, { accessToken: "t", accessTokenExpiresIn: 900, user: guestUser });
        if (url.endsWith("/users/me")) return json(200, guestUser);
        return json(404, { error: { code: "NOT_FOUND", message: "nope" } });
      }),
    );
    renderPage();
    expect(await screen.findByText("online (v0.1.0)")).toBeInTheDocument();
    expect(await screen.findByText("connected")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Start a guest session" }));
    expect(await screen.findByTestId("user-id")).toHaveTextContent(guestUser.id);
    expect(screen.getByTestId("session-status")).toHaveTextContent("Guest healer (guest)");
  });

  it("shows the API as offline when the backend is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    renderPage();
    expect(await screen.findByText("offline")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start a guest session" })).toBeDisabled();
  });
});
