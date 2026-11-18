import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSessionStore } from "@/lib/auth/session-store";
import { json, mockApi, renderRoute } from "@/test/render";
import { LoginPage, RegisterPage } from "./pages";

afterEach(() => vi.unstubAllGlobals());
const user = (roles: string[]) => ({
  id: "u1",
  email: "a@example.com",
  displayName: "A",
  roles,
  emailVerified: true,
  isGuest: false,
  mfaEnabled: true,
  suspended: false,
  createdAt: "",
});

describe("sign-in and registration forms", () => {
  it("validates with the shared contract schema before calling the API", async () => {
    useSessionStore.setState({ status: "anonymous", user: null, accessToken: null });
    const { calls } = mockApi({});
    renderRoute(<LoginPage />);
    await userEvent.type(screen.getByLabelText("Email"), "not-an-email");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText(/email/i, { selector: "p" })).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it("signs in and sends staff to their console", async () => {
    useSessionStore.setState({ status: "anonymous", user: null, accessToken: null });
    mockApi({
      "POST /api/v1/auth/login": () =>
        json(200, {
          accessToken: "t",
          accessTokenExpiresIn: 900,
          user: user(["player", "reviewer"]),
          mfaRequired: true,
        }),
    });
    const { router } = renderRoute(<LoginPage />, { path: "/login", url: "/login" });
    await userEvent.type(screen.getByLabelText("Email"), "a@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "healthy-nation-1");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/review"));
    expect(useSessionStore.getState()).toMatchObject({ status: "authenticated", mfaPending: true });
  });

  it("ignores external post-login redirects", async () => {
    useSessionStore.setState({ status: "anonymous", user: null, accessToken: null });
    mockApi({
      "POST /api/v1/auth/login": () =>
        json(200, { accessToken: "t", accessTokenExpiresIn: 900, user: user(["player"]) }),
    });
    const { router } = renderRoute(<LoginPage />, {
      path: "/login",
      url: "/login?next=//evil.example",
    });
    await userEvent.type(screen.getByLabelText("Email"), "a@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "healthy-nation-1");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/play"));
  });

  it("checks that passwords match when registering", async () => {
    useSessionStore.setState({ status: "anonymous", user: null, accessToken: null });
    const { calls } = mockApi({});
    renderRoute(<RegisterPage />);
    await userEvent.type(screen.getByLabelText("Display name"), "Amina");
    await userEvent.type(screen.getByLabelText("Email"), "amina@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "healthy-nation-1");
    await userEvent.type(screen.getByLabelText("Confirm password"), "different-1");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("Passwords don't match")).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });
});
