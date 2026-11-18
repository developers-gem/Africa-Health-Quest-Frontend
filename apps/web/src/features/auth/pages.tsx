import { zodResolver } from "@hookform/resolvers/zod";
import {
  EmailRequestSchema,
  LoginRequestSchema,
  RegisterRequestSchema,
  ResetPasswordRequestSchema,
} from "@ahq/api-contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, MailCheck } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router";
import { z } from "zod";
import { Field, fieldAria } from "@/components/common/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authApi } from "@/lib/api/auth";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { isStaff } from "@/lib/auth/permissions";
import { useSessionStore } from "@/lib/auth/session-store";

function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:py-16">
      <Card>
        <CardHeader>
          <h1 className="font-display text-2xl font-extrabold leading-tight">{title}</h1>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
      {footer && <div className="mt-6 text-center text-sm">{footer}</div>}
    </div>
  );
}

function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <Alert variant="destructive">
      <AlertDescription>{errorMessage(error)}</AlertDescription>
    </Alert>
  );
}

/** Only same-origin relative paths are allowed as post-login redirects. */
function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

export function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const next = safeNext(params.get("next"));
  const form = useForm<z.input<typeof LoginRequestSchema>>({
    resolver: zodResolver(LoginRequestSchema),
  });
  const login = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      qc.clear();
      const home = !isStaff(data.user)
        ? "/play"
        : data.user.roles.includes("admin")
          ? "/admin"
          : "/review";
      navigate(next ?? home, { replace: true });
    },
  });
  const unverified = login.error instanceof ApiError && login.error.code === "EMAIL_NOT_VERIFIED";
  const resend = useMutation({
    mutationFn: () => authApi.resendVerification(form.getValues("email") ?? ""),
  });
  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to continue your progress on any device."
      footer={
        <>
          New here?{" "}
          <Link to="/register" className="font-bold text-primary underline underline-offset-2">
            Create an account
          </Link>
        </>
      }
    >
      <form
        className="space-y-4"
        noValidate
        onSubmit={form.handleSubmit((v) => login.mutate(v as { email: string; password: string }))}
      >
        {unverified ? (
          <Alert variant="warning">
            <AlertDescription className="space-y-2">
              <p>Please confirm your email address first — check your inbox for our link.</p>
              {resend.isSuccess ? (
                <p className="font-bold">We've sent a new link if the account exists.</p>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  loading={resend.isPending}
                  onClick={() => resend.mutate()}
                >
                  Resend the link
                </Button>
              )}
            </AlertDescription>
          </Alert>
        ) : (
          <FormError error={login.error} />
        )}
        <Field id="email" label="Email" error={form.formState.errors.email?.message}>
          <Input
            {...fieldAria("email", form.formState.errors.email?.message)}
            type="email"
            autoComplete="email"
            {...form.register("email")}
          />
        </Field>
        <Field id="password" label="Password" error={form.formState.errors.password?.message}>
          <Input
            {...fieldAria("password", form.formState.errors.password?.message)}
            type="password"
            autoComplete="current-password"
            {...form.register("password")}
          />
        </Field>
        <div className="text-right text-sm">
          <Link
            to="/forgot-password"
            className="font-bold text-primary underline underline-offset-2"
          >
            Forgot your password?
          </Link>
        </div>
        <Button type="submit" className="w-full" size="lg" loading={login.isPending}>
          Sign in
        </Button>
      </form>
      <GoogleSignIn onSignedIn={() => navigate(next ?? "/play", { replace: true })} />
    </AuthCard>
  );
}

/** Google sign-in (Google Identity Services) — shown only when VITE_GOOGLE_CLIENT_ID is configured. */
function GoogleSignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (!clientId || !ref.current) return;
    const el = ref.current;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      const g = (
        window as unknown as {
          google?: {
            accounts: {
              id: {
                initialize: (o: object) => void;
                renderButton: (e: HTMLElement, o: object) => void;
              };
            };
          };
        }
      ).google;
      g?.accounts.id.initialize({
        client_id: clientId,
        callback: async (r: { credential: string }) => {
          try {
            await authApi.google(r.credential);
            onSignedIn();
          } catch (e) {
            setError(errorMessage(e));
          }
        },
      });
      g?.accounts.id.renderButton(el, {
        theme: "outline",
        size: "large",
        shape: "pill",
        width: 320,
      });
    };
    document.head.appendChild(script);
    return () => script.remove();
  }, [clientId, onSignedIn]);
  if (!clientId) return null;
  return (
    <div className="mt-6 space-y-2 border-t-2 border-foreground/10 pt-6 text-center">
      <div ref={ref} className="flex justify-center" />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

const RegisterFormSchema = RegisterRequestSchema.extend({ confirm: z.string() }).refine(
  (v) => v.password === v.confirm,
  {
    path: ["confirm"],
    message: "Passwords don't match",
  },
);

export function RegisterPage() {
  const navigate = useNavigate();
  const user = useSessionStore((s) => s.user);
  const upgrading = Boolean(user?.isGuest);
  const form = useForm<z.input<typeof RegisterFormSchema>>({
    resolver: zodResolver(RegisterFormSchema),
  });
  const register = useMutation({
    mutationFn: async (v: { email: string; password: string; displayName: string }) => {
      // Decide before the request: a successful upgrade turns the session user into a registered one.
      const wasGuest = upgrading;
      if (wasGuest) await authApi.upgradeGuest(v);
      else await authApi.register(v);
      return { email: v.email, upgraded: wasGuest };
    },
    onSuccess: ({ email, upgraded }) =>
      navigate(`/check-email?email=${encodeURIComponent(email)}${upgraded ? "&upgraded=1" : ""}`),
  });
  const err = (k: keyof z.input<typeof RegisterFormSchema>) => form.formState.errors[k]?.message;
  return (
    <AuthCard
      title={upgrading ? "Save your progress" : "Create your account"}
      description={
        upgrading
          ? "Turn your guest game into an account. Your Health Points, funding and cases come with you."
          : "Keep your progress across devices and unlock AI debriefs history."
      }
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-bold text-primary underline underline-offset-2">
            Sign in
          </Link>
        </>
      }
    >
      <form
        className="space-y-4"
        noValidate
        onSubmit={form.handleSubmit((v) =>
          register.mutate({ email: v.email, password: v.password, displayName: v.displayName }),
        )}
      >
        <FormError error={register.error} />
        <Field
          id="displayName"
          label="Display name"
          hint="Shown in the game. You can use a nickname."
          error={err("displayName")}
        >
          <Input
            {...fieldAria("displayName", err("displayName"))}
            autoComplete="nickname"
            {...form.register("displayName")}
          />
        </Field>
        <Field id="email" label="Email" error={err("email")}>
          <Input
            {...fieldAria("email", err("email"))}
            type="email"
            autoComplete="email"
            {...form.register("email")}
          />
        </Field>
        <Field
          id="password"
          label="Password"
          hint="At least 8 characters, with letters and numbers."
          error={err("password")}
        >
          <Input
            {...fieldAria("password", err("password"))}
            type="password"
            autoComplete="new-password"
            {...form.register("password")}
          />
        </Field>
        <Field id="confirm" label="Confirm password" error={err("confirm")}>
          <Input
            {...fieldAria("confirm", err("confirm"))}
            type="password"
            autoComplete="new-password"
            {...form.register("confirm")}
          />
        </Field>
        <Button type="submit" className="w-full" size="lg" loading={register.isPending}>
          {upgrading ? "Create account and keep progress" : "Create account"}
        </Button>
        <p className="text-xs text-muted-foreground">
          By creating an account you agree to use the game for education only. Never enter
          information about real patients.
        </p>
      </form>
    </AuthCard>
  );
}

export function CheckEmailPage() {
  const [params] = useSearchParams();
  const email = params.get("email") ?? "";
  const upgraded = params.get("upgraded") === "1";
  const resend = useMutation({ mutationFn: () => authApi.resendVerification(email) });
  return (
    <AuthCard
      title="Check your email"
      description={`We've sent a confirmation link to ${email || "your inbox"}.`}
    >
      <div className="space-y-4 text-center">
        <MailCheck className="mx-auto size-14 text-secondary" />
        <p className="text-sm text-muted-foreground">
          {upgraded
            ? "Your progress is already saved to your new account. Confirm your email so you can sign in on other devices."
            : "Open the link to activate your account, then sign in."}
        </p>
        {email && (
          <Button
            variant="outline"
            loading={resend.isPending}
            disabled={resend.isSuccess}
            onClick={() => resend.mutate()}
          >
            {resend.isSuccess ? "Link sent" : "Resend the link"}
          </Button>
        )}
        <div>
          <Button asChild variant={upgraded ? "default" : "link"}>
            <Link to={upgraded ? "/play" : "/login"}>
              {upgraded ? "Back to the game" : "Go to sign in"}
            </Link>
          </Button>
        </div>
      </div>
    </AuthCard>
  );
}

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const verify = useMutation({ mutationFn: () => authApi.verifyEmail(token) });
  const started = useRef(false);
  useEffect(() => {
    if (token && !started.current) {
      started.current = true;
      verify.mutate();
    }
  }, [token, verify]);
  return (
    <AuthCard title="Confirming your email">
      <div className="space-y-4 text-center">
        {!token ? (
          <p>This link is missing its token. Open the link from your email again.</p>
        ) : verify.isPending || verify.isIdle ? (
          <p role="status">One moment…</p>
        ) : verify.isSuccess ? (
          <>
            <CheckCircle2 className="mx-auto size-14 text-success" />
            <p className="font-bold">Your email is confirmed.</p>
            <Button asChild>
              <Link to="/login">Sign in</Link>
            </Button>
          </>
        ) : (
          <>
            <FormError error={verify.error} />
            <Button asChild variant="outline">
              <Link to="/login">Back to sign in</Link>
            </Button>
          </>
        )}
      </div>
    </AuthCard>
  );
}

export function ForgotPasswordPage() {
  const form = useForm<z.input<typeof EmailRequestSchema>>({
    resolver: zodResolver(EmailRequestSchema),
  });
  const forgot = useMutation({ mutationFn: (email: string) => authApi.forgotPassword(email) });
  return (
    <AuthCard
      title="Reset your password"
      description="Enter your email and we'll send you a reset link."
    >
      {forgot.isSuccess ? (
        <Alert variant="success">
          <AlertDescription>
            If an account exists for that email, a reset link is on its way. The link expires soon,
            so use it promptly.
          </AlertDescription>
        </Alert>
      ) : (
        <form
          className="space-y-4"
          noValidate
          onSubmit={form.handleSubmit((v) => forgot.mutate(v.email as string))}
        >
          <FormError error={forgot.error} />
          <Field id="email" label="Email" error={form.formState.errors.email?.message}>
            <Input
              {...fieldAria("email", form.formState.errors.email?.message)}
              type="email"
              autoComplete="email"
              {...form.register("email")}
            />
          </Field>
          <Button type="submit" className="w-full" loading={forgot.isPending}>
            Send reset link
          </Button>
        </form>
      )}
      <div className="mt-4 text-center text-sm">
        <Link to="/login" className="font-bold text-primary underline underline-offset-2">
          Back to sign in
        </Link>
      </div>
    </AuthCard>
  );
}

const ResetFormSchema = ResetPasswordRequestSchema.pick({ password: true })
  .extend({ confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const form = useForm<z.input<typeof ResetFormSchema>>({ resolver: zodResolver(ResetFormSchema) });
  const reset = useMutation({
    mutationFn: (password: string) => authApi.resetPassword({ token, password }),
  });
  return (
    <AuthCard
      title="Choose a new password"
      description="For your security, this signs you out on every device."
    >
      {reset.isSuccess ? (
        <div className="space-y-4 text-center">
          <CheckCircle2 className="mx-auto size-14 text-success" />
          <p className="font-bold">Password updated.</p>
          <Button asChild>
            <Link to="/login">Sign in</Link>
          </Button>
        </div>
      ) : (
        <form
          className="space-y-4"
          noValidate
          onSubmit={form.handleSubmit((v) => reset.mutate(v.password as string))}
        >
          {!token && (
            <Alert variant="destructive">
              <AlertDescription>
                This link is missing its token. Request a new reset link.
              </AlertDescription>
            </Alert>
          )}
          <FormError error={reset.error} />
          <Field
            id="password"
            label="New password"
            hint="At least 8 characters, with letters and numbers."
            error={form.formState.errors.password?.message}
          >
            <Input
              {...fieldAria("password", form.formState.errors.password?.message)}
              type="password"
              autoComplete="new-password"
              {...form.register("password")}
            />
          </Field>
          <Field
            id="confirm"
            label="Confirm new password"
            error={form.formState.errors.confirm?.message}
          >
            <Input
              {...fieldAria("confirm", form.formState.errors.confirm?.message)}
              type="password"
              autoComplete="new-password"
              {...form.register("confirm")}
            />
          </Field>
          <Button type="submit" className="w-full" loading={reset.isPending} disabled={!token}>
            Update password
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
