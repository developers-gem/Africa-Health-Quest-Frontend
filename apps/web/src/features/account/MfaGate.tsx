import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState, type ReactNode } from "react";
import { Field, fieldAria } from "@/components/common/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authApi } from "@/lib/api/auth";
import { errorMessage } from "@/lib/api/errors";
import { useSessionStore } from "@/lib/auth/session-store";

/** Staff areas require two-factor authentication (enforced by the API; this renders the setup/challenge). */
export function MfaGate({ children }: { children: ReactNode }) {
  const { mfaPending, mfaSetupRequired, user } = useSessionStore();
  // Login flags every staff session as needing MFA; users who haven't enrolled yet must set it up first.
  if (mfaSetupRequired || (mfaPending && user && !user.mfaEnabled)) return <MfaSetup />;
  if (mfaPending) return <MfaChallenge />;
  return <>{children}</>;
}

export function MfaSetup({ onDone }: { onDone?: () => void }) {
  const qc = useQueryClient();
  const [qr, setQr] = useState<string>();
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState<string[]>();
  const setup = useMutation({ mutationFn: authApi.mfaSetup });
  const verify = useMutation({
    mutationFn: () => authApi.mfaVerify(code),
    onSuccess: (r) => setRecovery(r.recoveryCodes),
  });
  useEffect(() => {
    setup.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (setup.data)
      void QRCode.toDataURL(setup.data.otpauthUri, { margin: 1, width: 200 }).then(setQr);
  }, [setup.data]);

  if (recovery) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle>Save your recovery codes</CardTitle>
          <CardDescription>
            Each code works once if you lose your phone. They will not be shown again — store them
            somewhere safe.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul
            className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-4 font-mono text-sm"
            data-testid="recovery-codes"
          >
            {recovery.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <Button
            className="w-full"
            onClick={() => {
              void navigator.clipboard?.writeText(recovery.join("\n"));
            }}
            variant="outline"
          >
            Copy codes
          </Button>
          <Button
            className="w-full"
            onClick={() => {
              authApi.finishMfaEnrollment();
              void qc.invalidateQueries();
              onDone?.();
            }}
          >
            I've saved them — continue
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-5" /> Set up two-factor authentication
        </CardTitle>
        <CardDescription>
          Staff accounts protect clinical content and player data. Scan this code with an
          authenticator app (for example Google Authenticator or Microsoft Authenticator), then
          enter the 6-digit code.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {setup.isError && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(setup.error)}</AlertDescription>
          </Alert>
        )}
        {setup.data && (
          <div className="flex flex-col items-center gap-3">
            {qr ? (
              <img
                src={qr}
                alt="QR code for your authenticator app"
                className="size-48 rounded-xl border-2 border-foreground bg-white p-2"
              />
            ) : null}
            <details className="w-full text-sm">
              <summary className="cursor-pointer font-bold">
                Can't scan? Enter the key manually
              </summary>
              <code
                className="mt-2 block break-all rounded-lg bg-muted p-2"
                data-testid="mfa-secret"
              >
                {setup.data.secret}
              </code>
            </details>
          </div>
        )}
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            verify.mutate();
          }}
        >
          <Field
            id="mfa-code"
            label="6-digit code"
            error={verify.isError ? errorMessage(verify.error) : undefined}
          >
            <Input
              {...fieldAria("mfa-code", verify.isError ? "x" : undefined)}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </Field>
          <Button
            type="submit"
            className="w-full"
            loading={verify.isPending}
            disabled={code.length !== 6 || !setup.data}
          >
            Verify and turn on
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function MfaChallenge() {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const challenge = useMutation({
    mutationFn: () => authApi.mfaChallenge(useRecovery ? { recoveryCode: code.trim() } : { code }),
    onSuccess: () => void qc.invalidateQueries(),
  });
  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-5" /> Two-factor check
        </CardTitle>
        <CardDescription>
          {useRecovery
            ? "Enter one of your recovery codes."
            : "Enter the 6-digit code from your authenticator app."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            challenge.mutate();
          }}
        >
          <Field
            id="mfa-challenge"
            label={useRecovery ? "Recovery code" : "Code"}
            error={challenge.isError ? errorMessage(challenge.error) : undefined}
          >
            <Input
              {...fieldAria("mfa-challenge", challenge.isError ? "x" : undefined)}
              inputMode={useRecovery ? "text" : "numeric"}
              autoComplete="one-time-code"
              value={code}
              onChange={(e) =>
                setCode(
                  useRecovery ? e.target.value : e.target.value.replace(/\D/g, "").slice(0, 6),
                )
              }
              autoFocus
            />
          </Field>
          <Button type="submit" className="w-full" loading={challenge.isPending} disabled={!code}>
            Continue
          </Button>
          <Button
            type="button"
            variant="link"
            onClick={() => (setUseRecovery(!useRecovery), setCode(""))}
          >
            {useRecovery ? "Use authenticator code instead" : "Use a recovery code"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
