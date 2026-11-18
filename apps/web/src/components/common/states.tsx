import type { UseQueryResult } from "@tanstack/react-query";
import { AlertTriangle, Inbox, RefreshCw, WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

export function LoadingState({
  label = "Loading…",
  rows = 3,
  className,
}: {
  label?: string;
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)} role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-foreground/30 bg-card/60 px-6 py-10 text-center",
        className,
      )}
    >
      <div className="text-4xl" aria-hidden="true">
        {icon ?? <Inbox className="size-10 text-muted-foreground" />}
      </div>
      <h3 className="text-lg font-extrabold">{title}</h3>
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const offline = error instanceof ApiError && error.code === "NETWORK_ERROR";
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border-2 border-destructive/40 bg-destructive/5 px-6 py-8 text-center",
        className,
      )}
    >
      {offline ? (
        <WifiOff className="size-8 text-destructive" />
      ) : (
        <AlertTriangle className="size-8 text-destructive" />
      )}
      <h3 className="font-extrabold">{offline ? "You're offline" : "We couldn't load this"}</h3>
      <p className="max-w-md text-sm text-muted-foreground">{errorMessage(error)}</p>
      {error instanceof ApiError && error.requestId && (
        <p className="text-xs text-muted-foreground">Reference: {error.requestId}</p>
      )}
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw /> Try again
        </Button>
      )}
    </div>
  );
}

/** Renders loading / error / empty / data states for a query consistently. */
export function QueryState<T>({
  query,
  children,
  empty,
  isEmpty,
  loading,
}: {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
  empty?: ReactNode;
  isEmpty?: (data: T) => boolean;
  loading?: ReactNode;
}) {
  if (query.isPending && query.fetchStatus !== "idle") return <>{loading ?? <LoadingState />}</>;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (query.data === undefined) return <>{loading ?? <LoadingState />}</>;
  if (empty && isEmpty?.(query.data)) return <>{empty}</>;
  return <>{children(query.data)}</>;
}
