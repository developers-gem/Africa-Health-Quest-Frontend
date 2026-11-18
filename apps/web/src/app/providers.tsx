import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { refreshSession } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { StepUpDialog } from "@/lib/step-up";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Don't retry client errors (4xx); retry network/server errors twice.
        retry: (count, err) =>
          !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
      },
    },
  });
}

export function Providers({ children, client }: { children: ReactNode; client?: QueryClient }) {
  const [queryClient] = useState(() => client ?? makeQueryClient());
  // Restore an existing session from the httpOnly refresh cookie on load (anonymous if none).
  useEffect(() => {
    void refreshSession();
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster />
      <StepUpDialog />
    </QueryClientProvider>
  );
}
