import { useMutation, useQuery } from "@tanstack/react-query";
import { Lock, Minus, Plus, Shuffle } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";
import { PageHeader, Pagination, StatCard } from "@/components/common/page";
import { EmptyState, LoadingState, QueryState } from "@/components/common/states";
import { ActionTile } from "@/components/game/ActionTile";
import { TierProgress } from "@/components/game/stats";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CountryCard, CountryFlag, TopicChips } from "@/features/public/components";
import { errorMessage } from "@/lib/api/errors";
import { attemptsApi, missionsApi, type MissionMode } from "@/lib/api/missions";
import { playerApi } from "@/lib/api/player";
import type { ShiftResult } from "@/lib/api/types";
import { hospitalApi, type AllocationInput } from "@/lib/api/world";
import { useSessionStore } from "@/lib/auth/session-store";
import { formatDate, formatFunding, formatPercent, relativeTime, titleCase } from "@/lib/format";
import {
  qk,
  useCountries,
  useHospitalState,
  useInvalidateProgress,
  useMissions,
  useProgress,
} from "@/lib/queries";
import { cn } from "@/lib/utils";
import { MissionCard, SectionTitle } from "./components";

function useStartAttempt() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: ({ key, mode }: { key: string; mode: MissionMode }) => attemptsApi.start(key, mode),
    onSuccess: (a) => navigate(`/play/attempts/${a.id}`),
    onError: (e) => toast.error(errorMessage(e)),
  });
}

// ---- 1. Dashboard ------------------------------------------------------------------------------

export function DashboardPage() {
  const user = useSessionStore((s) => s.user);
  const progress = useProgress();
  const inProgress = useQuery({
    queryKey: qk.attempts({ status: "in_progress" }),
    queryFn: () => playerApi.attempts({ status: "in_progress", pageSize: 3 }),
  });
  const stats = useQuery({ queryKey: qk.stats, queryFn: playerApi.stats });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">
          Welcome{user && !user.isGuest ? `, ${user.displayName}` : ""} 👋
        </h1>
        <p className="text-muted-foreground">Patients are waiting. Where will you work today?</p>
      </div>
      <QueryState query={progress} loading={<LoadingState rows={1} />}>
        {(p) => <TierProgress progress={p} guest={user?.isGuest} />}
      </QueryState>
      {inProgress.data && inProgress.data.items.length > 0 && (
        <Alert variant="info">
          <AlertTitle>Unfinished case</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {inProgress.data.items[0]!.title} — started{" "}
              {relativeTime(inProgress.data.items[0]!.startedAt)}
            </span>
            <Button asChild size="sm">
              <Link to={`/play/attempts/${inProgress.data.items[0]!.id}`}>Resume</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <ActionTile
          to="/play/story"
          icon="📖"
          title="Story Mode"
          description="Follow patients and communities"
          tone="primary"
        />
        <ActionTile
          to="/play/challenge"
          icon="🩺"
          title="Clinical Challenge"
          description="Rapid-fire cases for students"
          tone="secondary"
        />
        <ActionTile
          to="/play/commander"
          icon="🏥"
          title="Hospital Commander"
          description="Manage staff, beds & budgets"
          tone="accent"
        />
        <ActionTile
          to="/play/countries"
          icon="🌍"
          title="Countries"
          description="Expand across Africa"
        />
      </div>
      {stats.data && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Patients saved" value={stats.data.missionsPassed} icon="❤️" />
          <StatCard label="Accuracy" value={formatPercent(stats.data.accuracy)} icon="🎯" />
          <StatCard label="Countries" value={stats.data.countriesUnlocked} icon="🌍" />
          <StatCard label="Achievements" value={stats.data.achievementsEarned} icon="🏅" />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to="/play/missions">All missions</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/play/achievements">Achievements</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/play/history">Learning history</Link>
        </Button>
      </div>
    </div>
  );
}

// ---- 2. Story Mode -----------------------------------------------------------------------------

export function StoryModePage() {
  const missions = useMissions("story");
  const progress = useProgress();
  const items = missions.data?.items;
  const tiers = useMemo(() => {
    const byTier = new Map<number, NonNullable<typeof items>>();
    for (const m of items ?? []) byTier.set(m.tier, [...(byTier.get(m.tier) ?? []), m]);
    return [...byTier.entries()].sort(([a], [b]) => a - b);
  }, [items]);
  return (
    <div>
      <PageHeader
        back={{ to: "/play" }}
        title="📖 Story Mode"
        description="Follow patients and communities. New cases unlock as your hospital grows and you open new countries."
      />
      <QueryState
        query={missions}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            icon="🩺"
            title="No cases are published yet"
            description="Cases appear once a verified clinician approves them. Check back soon."
          />
        }
      >
        {() => (
          <div>
            {tiers.map(([tier, list]) => {
              const reached = (progress.data?.tier.index ?? 0) >= tier;
              return (
                <section key={tier}>
                  <SectionTitle className="flex items-center gap-2">
                    Level {tier + 1}{" "}
                    {!reached && (
                      <Lock className="size-4 text-muted-foreground" aria-label="locked" />
                    )}
                  </SectionTitle>
                  <div className="grid gap-3 md:grid-cols-2">
                    {list.map((m) => (
                      <MissionCard key={m.key} m={m} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </QueryState>
    </div>
  );
}

// ---- 3. Clinical Challenge ---------------------------------------------------------------------

export function ChallengePage() {
  const missions = useMissions("practice");
  const start = useStartAttempt();
  const random = useMutation({
    mutationFn: () => missionsApi.random({ mode: "practice" }),
    onSuccess: (m) => start.mutate({ key: m.key, mode: "practice" }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div>
      <PageHeader
        back={{ to: "/play" }}
        title="🩺 Clinical Challenge"
        description="Rapid-fire practice cases. No locks and no rewards — just learning. Your answers still count towards your learning history."
      />
      <div className="mb-6 rounded-2xl border-2 border-foreground bg-secondary p-6 text-secondary-foreground shadow-pop">
        <h2 className="text-xl font-extrabold">Random case</h2>
        <p className="opacity-90">Let the clinic surprise you with a patient.</p>
        <Button
          variant="accent"
          className="mt-4"
          loading={random.isPending || start.isPending}
          onClick={() => random.mutate()}
        >
          <Shuffle /> Give me a case
        </Button>
      </div>
      <QueryState
        query={missions}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            icon="🩺"
            title="No practice cases yet"
            description="Cases appear once a verified clinician approves them."
          />
        }
      >
        {(d) => (
          <div className="grid gap-3 md:grid-cols-2">
            {d.items.map((m) => (
              <MissionCard key={m.key} m={m} mode="practice" />
            ))}
          </div>
        )}
      </QueryState>
    </div>
  );
}

// ---- 4. Mission listing ------------------------------------------------------------------------

export function MissionListPage() {
  const [params, setParams] = useSearchParams();
  const mode = (params.get("mode") as MissionMode) || "story";
  const country = params.get("country") ?? undefined;
  const [search, setSearch] = useState("");
  const [topic, setTopic] = useState("all");
  const missions = useMissions(mode, country);
  const countries = useCountries();
  const topics = useMemo(
    () => [...new Set((missions.data?.items ?? []).flatMap((m) => m.topics))].sort(),
    [missions.data],
  );
  const set = (k: string, v: string | undefined) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };
  return (
    <div>
      <PageHeader
        back={{ to: "/play" }}
        title="Missions"
        description="Browse every clinician-approved case."
      />
      <div className="mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Search by title"
          aria-label="Search missions"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={mode} onValueChange={(v) => set("mode", v)}>
          <SelectTrigger aria-label="Mode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="story">Story mode</SelectItem>
            <SelectItem value="practice">Practice (no locks)</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={country ?? "all"}
          onValueChange={(v) => set("country", v === "all" ? undefined : v)}
        >
          <SelectTrigger aria-label="Country">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All countries</SelectItem>
            {(countries.data?.items ?? [])
              .filter((c) => c.missionCount > 0)
              .map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.flagEmoji} {c.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Select value={topic} onValueChange={setTopic}>
          <SelectTrigger aria-label="Topic">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All topics</SelectItem>
            {topics.map((t) => (
              <SelectItem key={t} value={t}>
                {titleCase(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <QueryState query={missions}>
        {(d) => {
          const list = d.items.filter(
            (m) =>
              m.title.toLowerCase().includes(search.trim().toLowerCase()) &&
              (topic === "all" || m.topics.includes(topic)),
          );
          if (!list.length)
            return <EmptyState title="No missions match" description="Try other filters." />;
          return (
            <div className="grid gap-3 md:grid-cols-2">
              {list.map((m) => (
                <MissionCard key={m.key} m={m} mode={mode} />
              ))}
            </div>
          );
        }}
      </QueryState>
    </div>
  );
}

// ---- 5. Mission details ------------------------------------------------------------------------

export function MissionDetailPage() {
  const { key = "" } = useParams();
  const [params] = useSearchParams();
  const preferPractice = params.get("mode") === "practice";
  const detail = useQuery({ queryKey: qk.mission(key), queryFn: () => missionsApi.detail(key) });
  const story = useMissions("story");
  const summary = story.data?.items.find((m) => m.key === key);
  const start = useStartAttempt();
  return (
    <div className="mx-auto max-w-3xl">
      <QueryState query={detail}>
        {(m) => (
          <>
            <PageHeader
              back={{ to: preferPractice ? "/play/challenge" : "/play/story" }}
              title={
                <span className="flex items-center gap-3">
                  <span aria-hidden="true">{m.icon}</span>
                  {m.title}
                </span>
              }
            />
            <Card>
              <CardContent className="space-y-4 pt-5">
                <p className="text-lg leading-relaxed">{m.story}</p>
                <div className="flex flex-wrap gap-2 text-sm">
                  <Badge variant="muted">{m.stepCount} decisions</Badge>
                  <Badge variant="muted">Up to {m.maxScore} points</Badge>
                  <Badge variant="muted">Country: {m.countryCode}</Badge>
                  <Badge variant="muted">Level {m.tier + 1}</Badge>
                </div>
                <TopicChips topics={m.topics} />
                {m.learningObjectives.length > 0 && (
                  <div>
                    <h2 className="font-extrabold">You will practise</h2>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                      {m.learningObjectives.map((o) => (
                        <li key={o}>{o}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {summary?.progress && (
                  <p className="text-sm text-muted-foreground">
                    Played {summary.progress.attempts}{" "}
                    {summary.progress.attempts === 1 ? "time" : "times"} · best score{" "}
                    {summary.progress.bestScore}/{m.maxScore}
                    {summary.progress.passed ? " · patient saved ✅" : ""}
                  </p>
                )}
              </CardContent>
            </Card>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              {summary?.locked ? (
                <Alert variant="warning" className="sm:flex-1">
                  <AlertDescription>
                    <Lock className="mr-1 inline size-4" />
                    {summary.lockReason === "tier"
                      ? "Story mode unlocks at a higher hospital level. Earn more Health Points first."
                      : "Unlock this mission's country to play it in story mode."}
                  </AlertDescription>
                </Alert>
              ) : (
                <Button
                  size="lg"
                  variant="game"
                  className="sm:flex-1"
                  loading={start.isPending && start.variables?.mode === "story"}
                  onClick={() => start.mutate({ key, mode: "story" })}
                >
                  Start story case
                </Button>
              )}
              <Button
                size="lg"
                variant="outline"
                className="sm:flex-1"
                loading={start.isPending && start.variables?.mode === "practice"}
                onClick={() => start.mutate({ key, mode: "practice" })}
              >
                Practice (no rewards)
              </Button>
            </div>
            <Card flat className="mt-6">
              <CardHeader>
                <CardTitle className="text-base">Clinically reviewed</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Approved by {m.verification.reviewerName} ({m.verification.credentials}) on{" "}
                  {formatDate(m.verification.approvedAt)}.
                </p>
                {m.verification.references.length > 0 && (
                  <ul className="list-disc space-y-1 pl-5">
                    {m.verification.references.map((r) => (
                      <li key={r.id}>
                        {r.url ? (
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="font-semibold text-primary underline underline-offset-2"
                          >
                            {r.title}
                          </a>
                        ) : (
                          r.title
                        )}
                        {r.organization ? ` — ${r.organization}` : ""}
                        {r.year ? ` (${r.year})` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </QueryState>
    </div>
  );
}

// ---- 9. Hospital Commander ---------------------------------------------------------------------

const EMPTY: AllocationInput = { staff: 0, beds: 0, ambulances: 0, supplies: 0 };

export function CommanderPage() {
  const state = useHospitalState();
  const invalidate = useInvalidateProgress();
  const [alloc, setAlloc] = useState<AllocationInput>(EMPTY);
  const [result, setResult] = useState<ShiftResult | null>(null);
  const [page, setPage] = useState(1);
  const runs = useQuery({
    queryKey: qk.hospitalRuns(page),
    queryFn: () => hospitalApi.runs(page, 5),
  });
  const run = useMutation({
    mutationFn: () => hospitalApi.run(alloc),
    onSuccess: (r) => {
      setResult(r);
      setAlloc(EMPTY);
      void invalidate();
      void runs.refetch();
      for (const a of r.achievements) toast.success(`Achievement unlocked: ${a.name}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader back={{ to: "/play" }} title="🏥 Hospital Commander" />
      <QueryState query={state}>
        {(s) => {
          const units = Object.values(alloc).reduce((a, n) => a + n, 0);
          const cost = units * s.unitCost;
          const affordable = cost <= s.budget;
          return (
            <>
              <p className="-mt-4 mb-4 text-muted-foreground">
                Allocate resources ({formatFunding(s.unitCost)} each) before the next shift. An
                emergency will strike. Each need you cover earns +{s.rewardsPerNeedMet.hp} HP and +
                {formatFunding(s.rewardsPerNeedMet.funding)}.
              </p>
              {result && <ShiftResultCard result={result} onClose={() => setResult(null)} />}
              <div className="space-y-3">
                {s.resources.map((r) => {
                  const v = alloc[r.key as keyof AllocationInput];
                  const change = (d: number) =>
                    setAlloc((a) => ({
                      ...a,
                      [r.key]: Math.max(
                        0,
                        Math.min(s.maxUnitsPerResource, a[r.key as keyof AllocationInput] + d),
                      ),
                    }));
                  return (
                    <div
                      key={r.key}
                      className="flex items-center gap-3 rounded-2xl border-2 border-foreground bg-card p-3 pl-4"
                    >
                      <span className="text-2xl" aria-hidden="true">
                        {r.icon}
                      </span>
                      <span className="flex-1 font-bold">{r.name}</span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="rounded-full bg-muted"
                        aria-label={`Fewer ${r.name}`}
                        disabled={v === 0}
                        onClick={() => change(-1)}
                      >
                        <Minus />
                      </Button>
                      <span
                        className="w-8 text-center font-display text-lg font-extrabold tabular-nums"
                        data-testid={`alloc-${r.key}`}
                        aria-live="polite"
                      >
                        {v}
                      </span>
                      <Button
                        size="icon"
                        variant="accent"
                        className="rounded-full"
                        aria-label={`More ${r.name}`}
                        disabled={v >= s.maxUnitsPerResource || cost + s.unitCost > s.budget}
                        onClick={() => change(1)}
                      >
                        <Plus />
                      </Button>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex justify-between text-sm font-bold text-muted-foreground">
                <span>Budget: {formatFunding(s.budget)}</span>
                <span className={cn(!affordable && "text-destructive")}>
                  Cost: {formatFunding(cost)}
                </span>
              </div>
              <Button
                size="lg"
                variant="game"
                className="mt-4 w-full"
                disabled={units === 0 || !affordable}
                loading={run.isPending}
                onClick={() => run.mutate()}
              >
                Start Shift ({formatFunding(cost)})
              </Button>
              {s.budget < s.unitCost && (
                <Alert variant="warning" className="mt-4">
                  <AlertDescription>
                    You're out of funding. Treat patients in Story Mode to earn more, then come
                    back.
                  </AlertDescription>
                </Alert>
              )}
              {s.recent.shifts > 0 && (
                <div className="mt-6 grid grid-cols-3 gap-3">
                  <StatCard label="Shifts" value={s.recent.shifts} />
                  <StatCard
                    label="Avg needs met"
                    value={s.recent.averageNeedsMet?.toFixed(1) ?? "—"}
                  />
                  <StatCard
                    label="Efficiency"
                    value={
                      s.recent.averageEfficiencyPercent != null
                        ? `${s.recent.averageEfficiencyPercent}%`
                        : "—"
                    }
                  />
                </div>
              )}
            </>
          );
        }}
      </QueryState>
      <SectionTitle>Shift history</SectionTitle>
      <QueryState
        query={runs}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            icon="🚑"
            title="No shifts yet"
            description="Allocate resources and start your first shift."
          />
        }
      >
        {(d) => (
          <>
            <ul className="space-y-2">
              {d.items.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl border-2 border-foreground/20 bg-card p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold">{r.event.text}</span>
                    <Badge
                      variant={r.needsMet >= 3 ? "success" : r.needsMet >= 2 ? "accent" : "outline"}
                    >
                      {r.needsMet}/4 needs
                    </Badge>
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    {relativeTime(r.createdAt)} · cost {formatFunding(r.cost)} · +{r.rewards.hp} HP
                    · net {r.netFundingChange >= 0 ? "+" : ""}
                    {formatFunding(r.netFundingChange)}
                  </div>
                </li>
              ))}
            </ul>
            <Pagination page={page} pageSize={d.pageSize} total={d.total} onPage={setPage} />
          </>
        )}
      </QueryState>
    </div>
  );
}

function ShiftResultCard({ result, onClose }: { result: ShiftResult; onClose: () => void }) {
  return (
    <Card className="mb-6 animate-in fade-in-0 zoom-in-95" data-testid="shift-result">
      <CardHeader>
        <CardTitle className="text-xl">🚨 {result.event.text}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="font-bold" aria-live="polite">
          {result.summary}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {result.outcomes.map((o) => (
            <div
              key={o.resource}
              className={cn(
                "rounded-xl border-2 p-3 text-center text-sm",
                o.met ? "border-success bg-success/10" : "border-destructive/50 bg-destructive/5",
              )}
            >
              <div className="font-bold">{titleCase(o.resource)}</div>
              <div className="tabular-nums">
                {o.allocated} / {o.needed} needed
              </div>
              <div className="text-xs font-bold">
                {o.met ? "Covered ✅" : `Short by ${o.shortfall}`}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="default">+{result.rewards.hp} HP</Badge>
          <Badge variant="secondary">
            Net funding {result.netFundingChange >= 0 ? "+" : ""}
            {formatFunding(result.netFundingChange)}
          </Badge>
          <Badge variant="outline">Rating: {titleCase(result.performance.rating)}</Badge>
          <Badge variant="outline">Efficiency {result.performance.efficiencyPercent}%</Badge>
        </div>
        <Button variant="outline" onClick={onClose}>
          Plan the next shift
        </Button>
      </CardContent>
    </Card>
  );
}

// ---- 10. Country expansion ---------------------------------------------------------------------

export function CountryExpansionPage() {
  const countries = useCountries();
  const progress = useProgress();
  const [filter, setFilter] = useState<"open" | "all">("open");
  return (
    <div>
      <PageHeader
        back={{ to: "/play" }}
        title="🌍 Countries"
        description="Expand across Africa. Countries unlock as your Health Points grow."
      />
      <div className="mb-4 flex gap-2">
        <Button
          size="sm"
          variant={filter === "open" ? "default" : "outline"}
          onClick={() => setFilter("open")}
        >
          Open to play
        </Button>
        <Button
          size="sm"
          variant={filter === "all" ? "default" : "outline"}
          onClick={() => setFilter("all")}
        >
          All 54 countries
        </Button>
      </div>
      <QueryState query={countries}>
        {({ items }) => {
          const list = items.filter((c) => filter === "all" || c.status === "active");
          const next = items
            .filter((c) => c.status === "active" && c.unlocked === false)
            .sort((a, b) => a.unlock.minHp - b.unlock.minHp)[0];
          return (
            <>
              {next && progress.data && (
                <Card flat className="mb-6">
                  <CardContent className="space-y-2 pt-5">
                    <div className="flex items-center gap-3">
                      <CountryFlag country={next} />
                      <div className="flex-1">
                        <div className="font-extrabold">Next: {next.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {Math.max(0, next.unlock.minHp - progress.data.hp)} more HP needed
                        </div>
                      </div>
                    </div>
                    <Progress
                      value={Math.min(
                        100,
                        (progress.data.hp / Math.max(1, next.unlock.minHp)) * 100,
                      )}
                      aria-label={`Progress to unlock ${next.name}`}
                    />
                  </CardContent>
                </Card>
              )}
              {list.length === 0 ? (
                <EmptyState title="No countries to show" />
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((c) => (
                    <CountryCard
                      key={c.code}
                      country={c}
                      to={
                        c.status === "active"
                          ? `/play/missions?country=${c.code}`
                          : `/countries/${c.code}`
                      }
                      showLock
                    />
                  ))}
                </div>
              )}
            </>
          );
        }}
      </QueryState>
    </div>
  );
}
