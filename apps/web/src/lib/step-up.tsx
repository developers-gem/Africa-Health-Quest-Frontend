import { useMutation, type UseMutationOptions } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { create } from "zustand";
import { Field } from "@/components/common/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { authApi } from "@/lib/api/auth";
import { ApiError, errorMessage } from "@/lib/api/errors";

type StepUpState = {
  pending: { resolve: (ok: boolean) => void } | null;
  ask: () => Promise<boolean>;
};
const useStepUpStore = create<StepUpState>((set) => ({
  pending: null,
  ask: () => new Promise<boolean>((resolve) => set({ pending: { resolve } })),
}));

/** Runs `fn`; if the API asks for recent authentication, prompts for the password once and retries. */
export async function withStepUp<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError && err.code === "STEP_UP_REQUIRED") {
      const ok = await useStepUpStore.getState().ask();
      if (ok) return fn();
    }
    throw err;
  }
}

/** useMutation with step-up retry and an error toast by default. */
export function useApiMutation<TData, TVars>(
  opts: UseMutationOptions<TData, unknown, TVars> & {
    successMessage?: string | ((d: TData) => string);
  },
) {
  const { mutationFn, successMessage, onError, onSuccess, ...rest } = opts;
  return useMutation<TData, unknown, TVars>({
    ...rest,
    mutationFn: (v, c) => withStepUp(() => mutationFn!(v, c)),
    onSuccess: (data, vars, ctx, m) => {
      if (successMessage)
        toast.success(typeof successMessage === "function" ? successMessage(data) : successMessage);
      return onSuccess?.(data, vars, ctx, m);
    },
    onError: (err, vars, ctx, m) => {
      if (onError) return onError(err, vars, ctx, m);
      toast.error(errorMessage(err));
    },
  });
}

/** Mounted once at the app root. */
export function StepUpDialog() {
  const pending = useStepUpStore((s) => s.pending);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const close = (ok: boolean) => {
    pending?.resolve(ok);
    useStepUpStore.setState({ pending: null });
    setPassword("");
    setError(undefined);
  };
  return (
    <Dialog open={Boolean(pending)} onOpenChange={(o) => !o && close(false)}>
      <DialogContent>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await authApi.reauthenticate(password);
              close(true);
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Confirm it's you</DialogTitle>
            <DialogDescription>
              This is a sensitive action. Enter your password to continue.
            </DialogDescription>
          </DialogHeader>
          <Field id="stepup-password" label="Password" error={error}>
            <Input
              id="stepup-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy} disabled={!password}>
              Confirm
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
