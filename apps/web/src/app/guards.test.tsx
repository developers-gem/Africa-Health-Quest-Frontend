import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSessionStore } from "@/lib/auth/session-store";
import { renderRoute, signIn } from "@/test/render";
import { RequirePermission, RequireRegistered, RequireSession } from "./guards";

afterEach(() => vi.unstubAllGlobals());

describe("route guards (UI only; the API authorises every request)", () => {
  it("blocks players from staff areas and lets permitted staff in", () => {
    signIn();
    renderRoute(<RequirePermission perms={["users:read"]}>admin area</RequirePermission>);
    expect(screen.getByText("You don't have access to this area")).toBeInTheDocument();
    expect(screen.queryByText("admin area")).not.toBeInTheDocument();
  });

  it("allows an admin", () => {
    signIn({ roles: ["player", "admin"] });
    renderRoute(<RequirePermission perms={["users:read"]}>admin area</RequirePermission>);
    expect(screen.getByText("admin area")).toBeInTheDocument();
  });

  it("offers guest play or sign-in to anonymous visitors", () => {
    useSessionStore.setState({ status: "anonymous", user: null, accessToken: null });
    renderRoute(<RequireSession>game</RequireSession>);
    expect(screen.getByRole("button", { name: "Play as guest" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login?next=%2F",
    );
  });

  it("asks guests to register for registered-only areas", () => {
    signIn({ isGuest: true, email: null });
    renderRoute(<RequireRegistered>reviewer profile</RequireRegistered>);
    expect(screen.getByText("Create an account first")).toBeInTheDocument();
  });

  it("waits while the session is being restored", () => {
    useSessionStore.setState({ status: "unknown", user: null, accessToken: null });
    renderRoute(<RequirePermission perms={["users:read"]}>admin area</RequirePermission>);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
