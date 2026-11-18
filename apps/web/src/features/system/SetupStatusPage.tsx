import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/lib/api/errors";
import { getHealth, getMe, getReadiness, signOut, startGuestSession } from "@/lib/api/endpoints";
import { API_BASE_URL } from "@/lib/config";
import { useSessionStore } from "@/lib/auth/session-store";

/**
 * Development setup check: proves the web app reaches the shared backend, the database is up, and the
 * guest-session + authenticated request flow works end to end. Replaced by the game Home screen in the
 * web application phase.
 */
export function SetupStatusPage() {
  const health = useQuery({ queryKey: ["system", "health"], queryFn: getHealth, retry: false });
  const ready = useQuery({ queryKey: ["system", "ready"], queryFn: getReadiness, retry: false });
  const { status, user } = useSessionStore();
  const me = useQuery({
    queryKey: ["users", "me", user?.id],
    queryFn: getMe,
    enabled: status === "authenticated",
  });
  const guest = useMutation({ mutationFn: startGuestSession });
  const logout = useMutation({ mutationFn: signOut });

  const apiState = health.isPending
    ? "checking…"
    : health.isSuccess
      ? `online (v${health.data.version})`
      : "offline";
  const dbState = ready.isPending ? "checking…" : ready.isSuccess ? "connected" : "unavailable";
  const error = (guest.error ?? me.error ?? logout.error) as ApiError | null;

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-extrabold leading-tight">
        Save Lives.
        <br />
        Build Healthier Nations.
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>Platform status</CardTitle>
          <p className="text-sm text-muted-foreground">Backend: {API_BASE_URL}</p>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="font-semibold">API</dt>
            <dd data-testid="api-status">{apiState}</dd>
            <dt className="font-semibold">Database</dt>
            <dd data-testid="db-status">{dbState}</dd>
            <dt className="font-semibold">Session</dt>
            <dd data-testid="session-status">
              {status === "authenticated" && user
                ? `${user.displayName}${user.isGuest ? " (guest)" : ""}`
                : status}
            </dd>
            {me.data && (
              <>
                <dt className="font-semibold">User id</dt>
                <dd data-testid="user-id" className="break-all font-mono text-xs">
                  {me.data.id}
                </dd>
              </>
            )}
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            {status !== "authenticated" ? (
              <Button
                variant="game"
                disabled={guest.isPending || !health.isSuccess}
                onClick={() => guest.mutate()}
              >
                {guest.isPending ? "Starting…" : "Start a guest session"}
              </Button>
            ) : (
              <Button variant="outline" disabled={logout.isPending} onClick={() => logout.mutate()}>
                Sign out
              </Button>
            )}
          </div>
          {error && (
            <p role="alert" className="mt-3 text-sm font-semibold text-destructive">
              {error.message}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
