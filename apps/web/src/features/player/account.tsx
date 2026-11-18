import { LEARNER_LEVEL_LABELS, LEARNER_LEVELS } from "@ahq/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Laptop, LogOut, Smartphone } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Field } from "@/components/common/form";
import { PageHeader, Pagination, StatCard } from "@/components/common/page";
import { EmptyState, QueryState } from "@/components/common/states";
import { TierProgress } from "@/components/game/stats";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MfaSetup } from "@/features/account/MfaGate";
import { authApi } from "@/lib/api/auth";
import { errorMessage } from "@/lib/api/errors";
import { playerApi } from "@/lib/api/player";
import type { PlayerProfile } from "@/lib/api/types";
import { useSessionStore } from "@/lib/auth/session-store";
import {
  formatDate,
  formatDateTime,
  formatFunding,
  formatPercent,
  learnerLevelLabel,
  relativeTime,
  titleCase,
} from "@/lib/format";
import { qk, useCountries, useProgress } from "@/lib/queries";
import { useApiMutation } from "@/lib/step-up";

// ---- 11. Player profile ------------------------------------------------------------------------

export function ProfilePage() {
  const user = useSessionStore((s) => s.user);
  const progress = useProgress();
  const profile = useQuery({ queryKey: qk.profile, queryFn: playerApi.profile });
  const stats = useQuery({ queryKey: qk.stats, queryFn: playerApi.stats });
  const countries = useCountries();
  const home = countries.data?.items.find((c) => c.code === profile.data?.homeCountryCode);
  return (
    <div className="space-y-6">
      <PageHeader
        title={user?.displayName ?? "Profile"}
        description={
          user?.isGuest
            ? "Guest player — create an account to keep your progress everywhere."
            : user?.email
        }
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/play/settings">Edit profile</Link>
          </Button>
        }
      />
      {progress.data && <TierProgress progress={progress.data} guest={user?.isGuest} />}
      <QueryState query={profile}>
        {(p) => (
          <Card flat>
            <CardContent className="grid gap-4 pt-5 sm:grid-cols-3">
              <div>
                <div className="text-xs font-bold uppercase text-muted-foreground">Level</div>
                <div className="font-bold">{learnerLevelLabel(p.learnerLevel)}</div>
              </div>
              <div>
                <div className="text-xs font-bold uppercase text-muted-foreground">Institution</div>
                <div className="font-bold">{p.institution ?? "Not set"}</div>
              </div>
              <div>
                <div className="text-xs font-bold uppercase text-muted-foreground">
                  Home country
                </div>
                <div className="font-bold">
                  {home ? `${home.flagEmoji} ${home.name}` : "Not set"}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </QueryState>
      <QueryState query={stats}>
        {(s) => (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Patients saved" value={s.missionsPassed} icon="❤️" />
              <StatCard
                label="Accuracy"
                value={formatPercent(s.accuracy)}
                hint={`${s.counters.correctAnswers}/${s.counters.answersTotal} answers`}
                icon="🎯"
              />
              <StatCard label="Perfect cases" value={s.counters.perfectScores} icon="⭐" />
              <StatCard label="Practice cases" value={s.counters.practiceCompleted} icon="🩺" />
              <StatCard label="Shifts run" value={s.counters.shiftsRun} icon="🏥" />
              <StatCard label="Needs covered" value={s.counters.needsMet} icon="🚑" />
              <StatCard label="Countries" value={s.countriesUnlocked} icon="🌍" />
              <StatCard label="Achievements" value={s.achievementsEarned} icon="🏅" />
            </div>
          </>
        )}
      </QueryState>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link to="/play/achievements">🏅 Achievements</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/play/history">📚 Learning history</Link>
        </Button>
      </div>
    </div>
  );
}

// ---- 12. Achievements --------------------------------------------------------------------------

export function AchievementsPage() {
  const achievements = useQuery({ queryKey: qk.achievements, queryFn: playerApi.achievements });
  return (
    <div>
      <PageHeader
        back={{ to: "/play/profile" }}
        title="🏅 Achievements"
        description="Milestones on your journey. Some come with bonus Health Points and funding."
      />
      <QueryState
        query={achievements}
        isEmpty={(a) => a.earned.length + a.available.length === 0}
        empty={
          <EmptyState
            title="No achievements yet"
            description="Achievements will appear here once they're configured."
          />
        }
      >
        {(a) => (
          <div className="space-y-8">
            <section>
              <h2 className="mb-3 text-xl font-extrabold">Earned ({a.earned.length})</h2>
              {a.earned.length === 0 ? (
                <EmptyState
                  icon="🌱"
                  title="Your first achievement is close"
                  description="Save a patient in Story Mode to get started."
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {a.earned.map((x) => (
                    <div
                      key={x.key}
                      className="flex gap-3 rounded-2xl border-2 border-foreground bg-accent/30 p-4 shadow-pop-sm"
                      data-testid="achievement-earned"
                    >
                      <span className="text-3xl" aria-hidden="true">
                        {x.icon}
                      </span>
                      <div>
                        <div className="font-extrabold">{x.name}</div>
                        <div className="text-sm text-muted-foreground">{x.description}</div>
                        <div className="mt-1 text-xs font-bold">
                          Earned {formatDate(x.earnedAt)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section>
              <h2 className="mb-3 text-xl font-extrabold">In progress</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {a.available.map((x) => (
                  <div
                    key={x.key}
                    className="space-y-2 rounded-2xl border-2 border-foreground/30 bg-card p-4"
                  >
                    <div className="flex gap-3">
                      <span className="text-3xl grayscale" aria-hidden="true">
                        {x.icon}
                      </span>
                      <div>
                        <div className="font-extrabold">{x.name}</div>
                        <div className="text-sm text-muted-foreground">{x.description}</div>
                      </div>
                    </div>
                    <Progress
                      value={Math.min(100, (x.current / x.threshold) * 100)}
                      aria-label={`${x.name} progress`}
                    />
                    <div className="flex justify-between text-xs font-bold text-muted-foreground">
                      <span>
                        {Math.min(x.current, x.threshold)}/{x.threshold}
                      </span>
                      {(x.rewards.hp > 0 || x.rewards.funding > 0) && (
                        <span>
                          Reward: {x.rewards.hp ? `+${x.rewards.hp} HP ` : ""}
                          {x.rewards.funding ? `+${formatFunding(x.rewards.funding)}` : ""}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </QueryState>
    </div>
  );
}

// ---- 13. Learning history ----------------------------------------------------------------------

const STATUS_BADGE: Record<string, "success" | "outline" | "muted" | "accent"> = {
  completed: "success",
  in_progress: "accent",
  abandoned: "muted",
  expired: "muted",
};

export function HistoryPage() {
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState("all");
  const [ledgerPage, setLedgerPage] = useState(1);
  const q = { page, pageSize: 10, ...(mode !== "all" ? { mode } : {}) };
  const attempts = useQuery({ queryKey: qk.attempts(q), queryFn: () => playerApi.attempts(q) });
  const ledger = useQuery({
    queryKey: ["ledger", ledgerPage],
    queryFn: () => playerApi.ledger(ledgerPage, 15),
  });
  return (
    <div>
      <PageHeader
        back={{ to: "/play/profile" }}
        title="📚 Learning history"
        description="Every case you've played, with your scores and debriefs."
      />
      <Tabs defaultValue="cases">
        <TabsList>
          <TabsTrigger value="cases">Cases</TabsTrigger>
          <TabsTrigger value="ledger">Rewards ledger</TabsTrigger>
        </TabsList>
        <TabsContent value="cases">
          <div className="mb-4 w-48">
            <Select
              value={mode}
              onValueChange={(v) => {
                setMode(v);
                setPage(1);
              }}
            >
              <SelectTrigger aria-label="Filter by mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All modes</SelectItem>
                <SelectItem value="story">Story</SelectItem>
                <SelectItem value="practice">Practice</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <QueryState
            query={attempts}
            isEmpty={(d) => d.items.length === 0}
            empty={
              <EmptyState
                icon="📖"
                title="No cases yet"
                description="Your first case will show up here."
                action={
                  <Button asChild>
                    <Link to="/play/story">Play Story Mode</Link>
                  </Button>
                }
              />
            }
          >
            {(d) => (
              <>
                <ul className="space-y-2">
                  {d.items.map((a) => (
                    <li key={a.id}>
                      <Link
                        to={`/play/attempts/${a.id}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-foreground/20 bg-card p-3 hover:border-foreground"
                        data-testid="history-item"
                      >
                        <div className="min-w-0">
                          <div className="font-bold">{a.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {titleCase(a.mode)} · {formatDateTime(a.startedAt)}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {a.score != null && (
                            <Badge variant={a.passed ? "success" : "outline"}>
                              {a.score}/{a.maxScore}
                            </Badge>
                          )}
                          {a.rewards && a.rewards.hp > 0 && (
                            <Badge variant="default">+{a.rewards.hp} HP</Badge>
                          )}
                          <Badge variant={STATUS_BADGE[a.status] ?? "muted"}>
                            {titleCase(a.status)}
                          </Badge>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
                <Pagination page={page} pageSize={d.pageSize} total={d.total} onPage={setPage} />
              </>
            )}
          </QueryState>
        </TabsContent>
        <TabsContent value="ledger">
          <QueryState
            query={ledger}
            isEmpty={(d) => d.items.length === 0}
            empty={<EmptyState title="No rewards yet" />}
          >
            {(d) => (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead className="text-right">HP</TableHead>
                      <TableHead className="text-right">Funding</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.items.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="whitespace-nowrap">
                          {relativeTime(e.createdAt)}
                        </TableCell>
                        <TableCell>{titleCase(e.source)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {e.delta.hp >= 0 ? `+${e.delta.hp}` : e.delta.hp}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {e.delta.funding >= 0 ? `+${e.delta.funding}` : e.delta.funding}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right tabular-nums">
                          {e.balanceAfter.hp} HP · {formatFunding(e.balanceAfter.funding)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Pagination
                  page={ledgerPage}
                  pageSize={d.pageSize}
                  total={d.total}
                  onPage={setLedgerPage}
                />
              </>
            )}
          </QueryState>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---- 14. Account settings ----------------------------------------------------------------------

export function SettingsPage() {
  const user = useSessionStore((s) => s.user);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Account settings" />
      {user?.isGuest && (
        <Alert variant="warning">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>
              You're playing as a guest. Create an account so you don't lose your progress.
            </span>
            <Button asChild size="sm">
              <Link to="/register?upgrade=1">Create account</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <ProfileForm />
      {!user?.isGuest && <SecurityCard />}
      <DevicesCard />
      {!user?.isGuest && (
        <Card flat>
          <CardHeader>
            <CardTitle>Clinician reviewer</CardTitle>
            <CardDescription>
              Qualified clinicians can apply to review cases before they're published.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link to="/review/profile">Apply or view my application</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ProfileForm() {
  const user = useSessionStore((s) => s.user);
  const profile = useQuery({ queryKey: qk.profile, queryFn: playerApi.profile });
  return (
    <Card flat>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Your level tailors AI debriefs to your training.</CardDescription>
      </CardHeader>
      <CardContent>
        <QueryState query={profile}>
          {(p) =>
            user && <ProfileFields key={p.updatedAt} profile={p} displayName={user.displayName} />
          }
        </QueryState>
      </CardContent>
    </Card>
  );
}

function ProfileFields({ profile, displayName }: { profile: PlayerProfile; displayName: string }) {
  const qc = useQueryClient();
  const user = useSessionStore((s) => s.user);
  const countries = useCountries();
  const [form, setForm] = useState({
    displayName,
    learnerLevel: profile.learnerLevel ?? "",
    institution: profile.institution ?? "",
    homeCountryCode: profile.homeCountryCode ?? "",
    push: profile.notificationPrefs.push,
    email: profile.notificationPrefs.email,
  });
  const save = useMutation({
    mutationFn: async () => {
      if (user && form.displayName.trim() !== user.displayName)
        await authApi.updateMe(form.displayName.trim());
      return playerApi.updateProfile({
        learnerLevel: (form.learnerLevel || null) as never,
        institution: form.institution.trim() || null,
        homeCountryCode: form.homeCountryCode || null,
        notificationPrefs: { push: form.push, email: form.email },
      });
    },
    onSuccess: (p) => {
      qc.setQueryData(qk.profile, p);
      toast.success("Profile saved");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <Field
        id="displayName"
        label="Display name"
        error={form.displayName.trim() ? undefined : "Required"}
      >
        <Input
          id="displayName"
          value={form.displayName}
          maxLength={60}
          onChange={(e) => setForm({ ...form, displayName: e.target.value })}
        />
      </Field>
      <Field id="learnerLevel" label="Training level">
        <Select
          value={form.learnerLevel}
          onValueChange={(v) => setForm({ ...form, learnerLevel: v })}
        >
          <SelectTrigger id="learnerLevel">
            <SelectValue placeholder="Choose your level" />
          </SelectTrigger>
          <SelectContent>
            {LEARNER_LEVELS.map((l) => (
              <SelectItem key={l} value={l}>
                {LEARNER_LEVEL_LABELS[l]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field id="institution" label="Institution" optional>
        <Input
          id="institution"
          value={form.institution}
          maxLength={120}
          onChange={(e) => setForm({ ...form, institution: e.target.value })}
        />
      </Field>
      <Field id="homeCountry" label="Home country" optional>
        <Select
          value={form.homeCountryCode}
          onValueChange={(v) => setForm({ ...form, homeCountryCode: v })}
        >
          <SelectTrigger id="homeCountry">
            <SelectValue placeholder="Choose a country" />
          </SelectTrigger>
          <SelectContent>
            {(countries.data?.items ?? []).map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.flagEmoji} {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-foreground/15 p-3 sm:col-span-2">
        <label htmlFor="pref-push" className="text-sm font-bold">
          Push notifications (mobile app)
        </label>
        <Switch
          id="pref-push"
          checked={form.push}
          onCheckedChange={(v) => setForm({ ...form, push: v })}
        />
      </div>
      <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-foreground/15 p-3 sm:col-span-2">
        <label htmlFor="pref-email" className="text-sm font-bold">
          Email updates
        </label>
        <Switch
          id="pref-email"
          checked={form.email}
          onCheckedChange={(v) => setForm({ ...form, email: v })}
        />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" loading={save.isPending} disabled={!form.displayName.trim()}>
          Save profile
        </Button>
      </div>
    </form>
  );
}

function SecurityCard() {
  const user = useSessionStore((s) => s.user);
  const [setupOpen, setSetupOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const isStaff = user?.roles.some((r) => r !== "player");
  const disable = useApiMutation({
    mutationFn: () => authApi.disableMfa(),
    successMessage: "Two-factor authentication turned off",
    onSuccess: () => user && useSessionStore.getState().setUser({ ...user, mfaEnabled: false }),
  });
  const reset = useMutation({ mutationFn: () => authApi.forgotPassword(user!.email!) });
  return (
    <Card flat>
      <CardHeader>
        <CardTitle>Security</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-bold">Two-factor authentication</div>
            <div className="text-sm text-muted-foreground">
              {user?.mfaEnabled
                ? "On — you'll be asked for a code from your authenticator app."
                : "Off"}
              {isStaff ? " Required for clinicians and administrators." : ""}
            </div>
          </div>
          {user?.mfaEnabled ? (
            !isStaff && (
              <Button variant="outline" size="sm" onClick={() => setDisableOpen(true)}>
                Turn off
              </Button>
            )
          ) : (
            <Button size="sm" onClick={() => setSetupOpen(true)}>
              Set up
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-foreground/10 pt-4">
          <div>
            <div className="font-bold">Password</div>
            <div className="text-sm text-muted-foreground">
              We'll email you a secure link to choose a new password.
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            loading={reset.isPending}
            disabled={reset.isSuccess}
            onClick={() => reset.mutate()}
          >
            {reset.isSuccess ? "Link sent" : "Send reset link"}
          </Button>
        </div>
      </CardContent>
      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent
          className="max-w-xl border-0 bg-transparent p-0 shadow-none"
          aria-describedby={undefined}
        >
          <MfaSetup onDone={() => setSetupOpen(false)} />
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={disableOpen}
        onOpenChange={setDisableOpen}
        title="Turn off two-factor authentication?"
        description="Your account will only be protected by your password."
        confirmLabel="Turn off"
        variant="destructive"
        loading={disable.isPending}
        onConfirm={() => disable.mutate(undefined, { onSuccess: () => setDisableOpen(false) })}
      />
    </Card>
  );
}

function DevicesCard() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const sessions = useQuery({ queryKey: ["sessions"], queryFn: authApi.sessions });
  const revoke = useMutation({
    mutationFn: authApi.revokeSession,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["sessions"] }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const [allOpen, setAllOpen] = useState(false);
  const all = useMutation({
    mutationFn: authApi.logoutAll,
    onSuccess: () => {
      qc.clear();
      navigate("/login");
    },
  });
  return (
    <Card flat>
      <CardHeader>
        <CardTitle>Signed-in devices</CardTitle>
        <CardDescription>Sign out of devices you don't recognise.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <QueryState query={sessions}>
          {(d) => (
            <ul className="space-y-2">
              {d.items.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-3 rounded-xl border-2 border-foreground/15 p-3"
                >
                  {s.platform === "mobile" ? (
                    <Smartphone className="size-5" />
                  ) : (
                    <Laptop className="size-5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">
                      {s.platform === "mobile"
                        ? `Mobile app${s.appVersion ? ` ${s.appVersion}` : ""}`
                        : "Web browser"}
                      {s.current && (
                        <Badge variant="success" className="ml-2">
                          This device
                        </Badge>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      Active {relativeTime(s.lastUsedAt)} · signed in {formatDate(s.createdAt)}
                    </div>
                  </div>
                  {!s.current && (
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={revoke.isPending && revoke.variables === s.id}
                      onClick={() => revoke.mutate(s.id)}
                    >
                      Sign out
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </QueryState>
        <Button variant="outline" onClick={() => setAllOpen(true)}>
          <LogOut /> Sign out everywhere
        </Button>
        <ConfirmDialog
          open={allOpen}
          onOpenChange={setAllOpen}
          title="Sign out of every device?"
          description="Including this one. Guests will lose access to their progress unless they've created an account."
          confirmLabel="Sign out everywhere"
          variant="destructive"
          loading={all.isPending}
          onConfirm={() => all.mutate()}
        />
      </CardContent>
    </Card>
  );
}
