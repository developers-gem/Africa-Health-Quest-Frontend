import type { Permission } from "@ahq/shared-types";
import { useMutation } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { EmptyState, LoadingState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { startGuestSession } from "@/lib/api/endpoints";
import { errorMessage } from "@/lib/api/errors";
import { can } from "@/lib/auth/permissions";
import { useSessionStore } from "@/lib/auth/session-store";

export function SessionLoading() {
  return (
    <div className="mx-auto max-w-md p-6">
      <LoadingState label="Restoring your session…" rows={2} />
    </div>
  );
}

/** Players may play as guests (progress is kept on the server and can be upgraded to an account). */
export function RequireSession({ children }: { children: ReactNode }) {
  const status = useSessionStore((s) => s.status);
  const location = useLocation();
  const navigate = useNavigate();
  const guest = useMutation({ mutationFn: startGuestSession });
  if (status === "unknown") return <SessionLoading />;
  if (status === "authenticated") return <>{children}</>;
  const next = encodeURIComponent(location.pathname + location.search);
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <EmptyState
        icon="🩺"
        title="Ready to start your shift?"
        description="Play straight away as a guest — your progress is saved on this device and you can create an account later without losing it."
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto">
            <Button
              loading={guest.isPending}
              onClick={() =>
                guest.mutate(undefined, {
                  onSuccess: () => navigate(location.pathname + location.search, { replace: true }),
                })
              }
            >
              Play as guest
            </Button>
            <Button asChild variant="outline">
              <Link to={`/login?next=${next}`}>Sign in</Link>
            </Button>
            {guest.isError && (
              <p className="text-sm text-destructive">{errorMessage(guest.error)}</p>
            )}
          </div>
        }
      />
    </div>
  );
}

export function RequireRegistered({ children }: { children: ReactNode }) {
  const { status, user } = useSessionStore();
  const location = useLocation();
  if (status === "unknown") return <SessionLoading />;
  if (status !== "authenticated")
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (user?.isGuest) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <EmptyState
          icon="🔐"
          title="Create an account first"
          description="This area needs a registered account. Your guest progress carries over when you sign up."
          action={
            <Button asChild>
              <Link to="/register?upgrade=1">Create account</Link>
            </Button>
          }
        />
      </div>
    );
  }
  return <>{children}</>;
}

export function Forbidden({ message }: { message?: string }) {
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <EmptyState
        icon={<Lock className="size-10 text-muted-foreground" />}
        title="You don't have access to this area"
        description={message ?? "Ask an administrator if you think you should."}
        action={
          <Button asChild variant="outline">
            <Link to="/play">Back to the game</Link>
          </Button>
        }
      />
    </div>
  );
}

/** UI guard only; every request is authorised again by the API. */
export function RequirePermission({
  perms,
  children,
}: {
  perms: Permission[];
  children: ReactNode;
}) {
  const { status, user } = useSessionStore();
  const location = useLocation();
  if (status === "unknown") return <SessionLoading />;
  if (status !== "authenticated")
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (!can(user, ...perms)) return <Forbidden />;
  return <>{children}</>;
}
