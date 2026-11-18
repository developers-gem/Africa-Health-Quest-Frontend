import { ACHIEVEMENT_CRITERIA, AI_MODELS } from "@ahq/api-contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ColumnChart } from "@/components/common/charts";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Field } from "@/components/common/form";
import { PageHeader, StatCard } from "@/components/common/page";
import { EmptyState, QueryState } from "@/components/common/states";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { adminApi } from "@/lib/api/admin";
import { ApiError, errorMessage } from "@/lib/api/errors";
import type {
  AdminAchievement,
  AiSettings,
  EconomySettings,
  HospitalEvent,
  HospitalSettings,
  ProgressionSettings,
  SettingVersion,
} from "@/lib/api/types";
import { useCan } from "@/lib/auth/permissions";
import {
  formatDateTime,
  formatNumber,
  formatUsd,
  learnerLevelLabel,
  titleCase,
} from "@/lib/format";
import { useApiMutation } from "@/lib/step-up";
import { useRange } from "./shared";

/** Publishes a new version of a platform setting with a change note (optimistic concurrency, audited). */
function useSaveSetting(key: string, current: SettingVersion | undefined) {
  const qc = useQueryClient();
  return useApiMutation({
    mutationFn: ({ value, note }: { value: Record<string, unknown>; note: string }) =>
      adminApi.updateSetting(key, { value, changeNote: note, expectedVersion: current!.version }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-setting", key] });
      void qc.invalidateQueries({ queryKey: ["admin-setting-history", key] });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "PRECONDITION_FAILED") {
        toast.error(
          "Someone else changed this setting. Reloaded the latest version — please re-apply your change.",
        );
        void qc.invalidateQueries({ queryKey: ["admin-setting", key] });
      } else if (e instanceof ApiError && e.details?.length) {
        toast.error(`${e.message} ${e.details.map((d) => `${d.path}: ${d.message}`).join("; ")}`);
      } else toast.error(errorMessage(e));
    },
    successMessage: (v) => `Saved as version ${v.version}`,
  });
}

function SaveBar({
  onSave,
  loading,
  disabled,
  version,
}: {
  onSave: (note: string) => void;
  loading: boolean;
  disabled?: boolean;
  version?: SettingVersion;
}) {
  const [open, setOpen] = useState(false);
  const canEdit = useCan("settings:edit");
  if (!canEdit)
    return (
      <p className="text-sm text-muted-foreground">
        Read-only: you don't have permission to change settings.
      </p>
    );
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button disabled={disabled} onClick={() => setOpen(true)}>
        Publish changes
      </Button>
      {version && (
        <span className="text-xs text-muted-foreground">
          Current version {version.version} · {formatDateTime(version.createdAt)} · "
          {version.changeNote}"
        </span>
      )}
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Publish a new version?"
        description="Takes effect for new games within about a minute. In-progress cases keep the rules they started with."
        requireReason
        reasonLabel="Change note (recorded in the audit log)"
        confirmLabel="Publish"
        loading={loading}
        onConfirm={(note) => {
          onSave(note);
          setOpen(false);
        }}
      />
    </div>
  );
}

function SettingHistory({ settingKey }: { settingKey: string }) {
  const history = useQuery({
    queryKey: ["admin-setting-history", settingKey],
    queryFn: () => adminApi.settingHistory(settingKey),
  });
  return (
    <details className="mt-4 text-sm">
      <summary className="cursor-pointer font-bold">Version history</summary>
      <QueryState query={history}>
        {(h) => (
          <ul className="mt-2 space-y-1">
            {h.items.map((v) => (
              <li key={v.version}>
                <Badge variant={v.status === "active" ? "success" : "muted"}>v{v.version}</Badge>{" "}
                {formatDateTime(v.createdAt)} — {v.changeNote}
              </li>
            ))}
          </ul>
        )}
      </QueryState>
    </details>
  );
}

const useSetting = <T,>(key: string) =>
  useQuery({
    queryKey: ["admin-setting", key],
    queryFn: () => adminApi.setting(key),
    select: (s) => ({ meta: s, value: s.value as unknown as T }),
  });

// ---- AI settings -------------------------------------------------------------------------------

export function AiSettingsPage() {
  const setting = useSetting<AiSettings>("ai");
  const provider = useQuery({
    queryKey: ["admin-ai-provider"],
    queryFn: adminApi.aiProvider,
    enabled: useCan("settings:read"),
  });
  const { range, control } = useRange("30");
  const usage = useQuery({
    queryKey: ["admin-ai-usage", range],
    queryFn: () => adminApi.aiUsage(range),
    enabled: useCan("analytics:read"),
  });
  return (
    <div className="space-y-6">
      <PageHeader
        title="AI settings"
        description="Learning debriefs use Anthropic's Claude on the server. AI never approves content or changes official answers."
      />
      {usage.data && (
        <>
          {usage.data.provider !== "anthropic" && (
            <Alert variant={usage.data.provider === "disabled" ? "warning" : "info"}>
              <AlertDescription>
                {usage.data.provider === "disabled"
                  ? "No AI provider is configured on the server (ANTHROPIC_API_KEY), so debriefs are unavailable regardless of these settings."
                  : "The server is using the deterministic test provider — debriefs are labelled test output."}
              </AlertDescription>
            </Alert>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              label="Spend this month"
              value={formatUsd(usage.data.budget.monthUsd)}
              hint={`of ${formatUsd(usage.data.budget.capUsd)} cap`}
            />
            <StatCard
              label="Provider calls (period)"
              value={formatNumber(usage.data.totals.requests)}
              hint={`${formatNumber(usage.data.totals.completed)} completed`}
            />
            <StatCard
              label="Cost per completed debrief"
              value={
                usage.data.totals.costPerCompletedDebriefUsd === null
                  ? "—"
                  : formatUsd(usage.data.totals.costPerCompletedDebriefUsd)
              }
              hint={`${formatUsd(usage.data.totals.costUsd)} in the period`}
            />
            <StatCard
              label="Tokens (input / output)"
              value={`${formatNumber(usage.data.totals.inputTokens)} / ${formatNumber(usage.data.totals.outputTokens)}`}
              hint={`${formatNumber(usage.data.totals.cacheReadTokens)} read from cache`}
            />
            <StatCard
              label="Failed calls"
              value={formatNumber(
                usage.data.totals.invalidOutput +
                  usage.data.totals.providerUnavailable +
                  usage.data.totals.rateLimited +
                  usage.data.totals.refused,
              )}
              hint={`${usage.data.totals.rateLimited} rate-limited · ${usage.data.totals.invalidOutput} invalid · ${usage.data.totals.refused} refused · ${usage.data.totals.fallbackCalls} on fallback model`}
            />
            <StatCard
              label="Requests over player limits"
              value={formatNumber(usage.data.quotaRejections)}
              hint="Daily quota or per-minute limit; never sent to the provider"
            />
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs font-bold">
              <span>Monthly budget used</span>
              <span>{usage.data.budget.percent}%</span>
            </div>
            <Progress
              value={Math.min(100, usage.data.budget.percent)}
              aria-label="Monthly AI budget used"
              indicatorClassName={
                usage.data.budget.percent >= 100
                  ? "bg-destructive"
                  : usage.data.budget.percent >= 80
                    ? "bg-accent"
                    : "bg-chart-1"
              }
            />
          </div>
        </>
      )}
      {provider.data && (
        <Card flat data-testid="ai-provider">
          <CardHeader>
            <CardTitle className="text-base">Provider</CardTitle>
            <CardDescription>
              Set on the server (AI_PROVIDER, ANTHROPIC_API_KEY); the key is never shown here.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 text-sm">
            <Badge variant={provider.data.available ? "success" : "destructive"}>
              {provider.data.available ? "Available" : "Unavailable"}
            </Badge>
            <Badge variant="outline">Provider: {provider.data.provider}</Badge>
            <Badge variant="outline">
              API key: {provider.data.keyConfigured ? "configured" : "not configured"}
            </Badge>
            <Badge variant="outline">Model: {provider.data.model}</Badge>
            <Badge variant="outline">Fallback: {provider.data.fallbackModel ?? "none"}</Badge>
            <Badge variant="outline">Prompt: {provider.data.promptVersion}</Badge>
          </CardContent>
        </Card>
      )}
      <QueryState query={setting}>
        {({ meta, value }) => <AiForm key={meta.version} meta={meta} value={value} />}
      </QueryState>
      {usage.data && (
        <div className="space-y-2">
          <div className="flex justify-end">{control}</div>
          <ColumnChart
            title="Debrief requests per day"
            valueHeader="Requests"
            data={usage.data.series.map((s) => ({
              label: s.day,
              value: s.requests,
              note: `${s.failed} failed · ${s.refused} refused · ${formatUsd(s.costUsd)}`,
            }))}
          />
          {usage.data.byLevel.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Learner level</TableHead>
                  <TableHead className="text-right">Debriefs</TableHead>
                  <TableHead className="text-right">Completed</TableHead>
                  <TableHead className="text-right">Reported</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usage.data.byLevel.map((l) => (
                  <TableRow key={l.level}>
                    <TableCell>{learnerLevelLabel(l.level)}</TableCell>
                    <TableCell className="text-right">{l.debriefs}</TableCell>
                    <TableCell className="text-right">{l.completed}</TableCell>
                    <TableCell className="text-right">{l.flagged}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {usage.data.byModel.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model served</TableHead>
                  <TableHead className="text-right">Requests</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usage.data.byModel.map((m) => (
                  <TableRow key={m.model}>
                    <TableCell>{m.model}</TableCell>
                    <TableCell className="text-right">{m.requests}</TableCell>
                    <TableCell className="text-right">{formatUsd(m.costUsd)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
}

function AiForm({ meta, value: stored }: { meta: SettingVersion; value: AiSettings }) {
  // Settings saved before a field existed lack it: show the server's defaults.
  const value: AiSettings = {
    ...stored,
    burstPerMinute: stored.burstPerMinute ?? 3,
    fallbackModel: stored.fallbackModel ?? null,
  };
  const [f, setF] = useState(value);
  const save = useSaveSetting("ai", meta);
  const changed = JSON.stringify(f) !== JSON.stringify(value);
  return (
    <Card flat>
      <CardHeader>
        <CardTitle className="text-base">Debrief generation</CardTitle>
        <CardDescription>
          Changing model or effort affects quality and cost — re-run the clinician evaluation set
          before switching models.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-foreground/15 p-3">
          <label htmlFor="ai-enabled" className="font-bold">
            Debriefs enabled (kill switch)
          </label>
          <Switch
            id="ai-enabled"
            checked={f.enabled}
            onCheckedChange={(v) => setF({ ...f, enabled: v })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="ai-model" label="Model">
            <Select
              value={f.model}
              onValueChange={(v) => setF({ ...f, model: v as AiSettings["model"] })}
            >
              <SelectTrigger id="ai-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AI_MODELS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            id="ai-effort"
            label="Effort"
            hint="Higher effort = more thorough and more expensive"
          >
            <Select
              value={f.effort}
              onValueChange={(v) => setF({ ...f, effort: v as AiSettings["effort"] })}
            >
              <SelectTrigger id="ai-effort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["low", "medium", "high"].map((m) => (
                  <SelectItem key={m} value={m}>
                    {titleCase(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="ai-q-reg" label="Daily debriefs per registered player">
            <Input
              id="ai-q-reg"
              type="number"
              min={0}
              max={100}
              value={f.dailyQuotaRegistered}
              onChange={(e) => setF({ ...f, dailyQuotaRegistered: Number(e.target.value) })}
            />
          </Field>
          <Field id="ai-q-guest" label="Daily debriefs per guest">
            <Input
              id="ai-q-guest"
              type="number"
              min={0}
              max={100}
              value={f.dailyQuotaGuest}
              onChange={(e) => setF({ ...f, dailyQuotaGuest: Number(e.target.value) })}
            />
          </Field>
          <Field
            id="ai-budget"
            label="Monthly budget cap (USD)"
            hint="Debriefs pause automatically when the cap is reached."
          >
            <Input
              id="ai-budget"
              type="number"
              min={0}
              step="0.01"
              value={f.monthlyBudgetUsd}
              onChange={(e) => setF({ ...f, monthlyBudgetUsd: Number(e.target.value) })}
            />
          </Field>
          <Field
            id="ai-burst"
            label="Debrief requests per player per minute"
            hint="Protects the provider rate limit and budget from bursts."
          >
            <Input
              id="ai-burst"
              type="number"
              min={1}
              max={30}
              value={f.burstPerMinute}
              onChange={(e) => setF({ ...f, burstPerMinute: Number(e.target.value) })}
            />
          </Field>
          <Field
            id="ai-fallback-model"
            label="Fallback model when the provider is unavailable"
            hint="Tried once if the configured model is overloaded or rate-limited. Re-run the evaluation set before choosing one."
          >
            <Select
              value={f.fallbackModel ?? "none"}
              onValueChange={(v) =>
                setF({
                  ...f,
                  fallbackModel: v === "none" ? null : (v as AiSettings["model"]),
                })
              }
            >
              <SelectTrigger id="ai-fallback-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {AI_MODELS.filter((m) => m !== f.model).map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-foreground/15 p-3">
            <label htmlFor="ai-fallback" className="text-sm font-bold">
              Refusal fallback (re-run safety-declined requests on Anthropic's recommended fallback
              model)
            </label>
            <Switch
              id="ai-fallback"
              checked={f.refusalFallback}
              onCheckedChange={(v) => setF({ ...f, refusalFallback: v })}
            />
          </div>
        </div>
        <details>
          <summary className="cursor-pointer text-sm font-bold">
            Prices used for cost tracking (USD per million tokens)
          </summary>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead>Input</TableHead>
                <TableHead>Output</TableHead>
                <TableHead>Cache read</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(f.prices).map(([m, p]) => (
                <TableRow key={m}>
                  <TableCell>{m}</TableCell>
                  {(["inputPerMTok", "outputPerMTok", "cacheReadPerMTok"] as const).map((k) => (
                    <TableCell key={k}>
                      <Input
                        aria-label={`${m} ${k}`}
                        type="number"
                        min={0}
                        step="0.01"
                        className="h-9 w-24"
                        value={p[k]}
                        onChange={(e) =>
                          setF({
                            ...f,
                            prices: { ...f.prices, [m]: { ...p, [k]: Number(e.target.value) } },
                          })
                        }
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </details>
        <SaveBar
          version={meta}
          disabled={!changed}
          loading={save.isPending}
          onSave={(note) => save.mutate({ value: f as unknown as Record<string, unknown>, note })}
        />
        <SettingHistory settingKey="ai" />
      </CardContent>
    </Card>
  );
}

// ---- Platform configuration --------------------------------------------------------------------

export function ConfigurationPage() {
  return (
    <div>
      <PageHeader
        title="Platform configuration"
        description="Game rules are versioned: every change is audited and can be traced in the history."
      />
      <Tabs defaultValue="economy">
        <TabsList>
          <TabsTrigger value="economy">Economy</TabsTrigger>
          <TabsTrigger value="progression">Hospital levels</TabsTrigger>
          <TabsTrigger value="hospital">Commander rules</TabsTrigger>
          <TabsTrigger value="events">Emergencies</TabsTrigger>
          <TabsTrigger value="achievements">Achievements</TabsTrigger>
        </TabsList>
        <TabsContent value="economy">
          <EconomyTab />
        </TabsContent>
        <TabsContent value="progression">
          <ProgressionTab />
        </TabsContent>
        <TabsContent value="hospital">
          <HospitalTab />
        </TabsContent>
        <TabsContent value="events">
          <EventsTab />
        </TabsContent>
        <TabsContent value="achievements">
          <AchievementsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const ECONOMY_FIELDS: {
  k: keyof EconomySettings;
  label: string;
  hint?: string;
  type: "int" | "num" | "bool" | "basis";
}[] = [
  { k: "pointsPerCorrectStep", label: "Points per correct step", type: "int" },
  {
    k: "passThreshold",
    label: "Pass threshold",
    hint: "Share of the maximum score (0–1)",
    type: "num",
  },
  { k: "criticalChoiceFails", label: "A critical error fails the case", type: "bool" },
  { k: "startingHp", label: "Starting HP", type: "int" },
  { k: "startingFunding", label: "Starting funding", type: "int" },
  { k: "firstPassHpFactor", label: "First pass: HP × score", type: "num" },
  { k: "firstPassFundingFactor", label: "First pass: funding × score", type: "num" },
  { k: "completionRequiresPass", label: "A mission counts as done only when passed", type: "bool" },
  { k: "replayHpFactor", label: "Replay HP factor", hint: "0–1", type: "num" },
  { k: "replayHpBasis", label: "Replay HP based on", type: "basis" },
  { k: "replayFundingFactor", label: "Replay funding factor", type: "num" },
  { k: "practiceAwardsRewards", label: "Practice mode awards rewards", type: "bool" },
  { k: "shuffleChoices", label: "Shuffle answer order per attempt", type: "bool" },
];

function EconomyTab() {
  const s = useSetting<EconomySettings>("economy");
  return (
    <QueryState query={s}>
      {({ meta, value }) => <EconomyForm key={meta.version} meta={meta} value={value} />}
    </QueryState>
  );
}
function EconomyForm({ meta, value }: { meta: SettingVersion; value: EconomySettings }) {
  const [f, setF] = useState(value);
  const save = useSaveSetting("economy", meta);
  return (
    <Card flat>
      <CardContent className="space-y-4 pt-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {ECONOMY_FIELDS.map(({ k, label, hint, type }) =>
            type === "bool" ? (
              <div
                key={k}
                className="flex items-center justify-between gap-3 rounded-xl border-2 border-foreground/15 p-3"
              >
                <label htmlFor={`eco-${k}`} className="text-sm font-bold">
                  {label}
                </label>
                <Switch
                  id={`eco-${k}`}
                  checked={Boolean(f[k])}
                  onCheckedChange={(v) => setF({ ...f, [k]: v })}
                />
              </div>
            ) : type === "basis" ? (
              <Field key={k} id={`eco-${k}`} label={label}>
                <Select value={String(f[k])} onValueChange={(v) => setF({ ...f, [k]: v })}>
                  <SelectTrigger id={`eco-${k}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="improvement">Improvement over best score</SelectItem>
                    <SelectItem value="score">Full score</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            ) : (
              <Field key={k} id={`eco-${k}`} label={label} hint={hint}>
                <Input
                  id={`eco-${k}`}
                  type="number"
                  step={type === "int" ? 1 : 0.01}
                  value={Number(f[k])}
                  onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })}
                />
              </Field>
            ),
          )}
        </div>
        <SaveBar
          version={meta}
          disabled={JSON.stringify(f) === JSON.stringify(value)}
          loading={save.isPending}
          onSave={(note) => save.mutate({ value: f as unknown as Record<string, unknown>, note })}
        />
        <SettingHistory settingKey="economy" />
      </CardContent>
    </Card>
  );
}

function ProgressionTab() {
  const s = useSetting<ProgressionSettings>("progression");
  return (
    <QueryState query={s}>
      {({ meta, value }) => <ProgressionForm key={meta.version} meta={meta} value={value} />}
    </QueryState>
  );
}
function ProgressionForm({ meta, value }: { meta: SettingVersion; value: ProgressionSettings }) {
  const [tiers, setTiers] = useState(value.tiers);
  const save = useSaveSetting("progression", meta);
  const set = (i: number, patch: Partial<(typeof tiers)[number]>) =>
    setTiers(tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  return (
    <Card flat>
      <CardContent className="space-y-4 pt-5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Icon</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>HP required</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tiers.map((t, i) => (
              <TableRow key={i}>
                <TableCell>{i + 1}</TableCell>
                <TableCell>
                  <Input
                    aria-label={`Level ${i + 1} icon`}
                    className="h-9 w-16"
                    value={t.icon}
                    onChange={(e) => set(i, { icon: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    aria-label={`Level ${i + 1} name`}
                    className="h-9"
                    value={t.name}
                    onChange={(e) => set(i, { name: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    aria-label={`Level ${i + 1} key`}
                    className="h-9"
                    value={t.key}
                    onChange={(e) => set(i, { key: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    aria-label={`Level ${i + 1} HP`}
                    className="h-9 w-24"
                    type="number"
                    min={0}
                    disabled={i === 0}
                    value={t.hpRequired}
                    onChange={(e) => set(i, { hpRequired: Number(e.target.value) })}
                  />
                </TableCell>
                <TableCell>
                  {i === tiers.length - 1 && i > 0 && (
                    <Button size="sm" variant="ghost" onClick={() => setTiers(tiers.slice(0, -1))}>
                      Remove
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Button
          variant="outline"
          size="sm"
          disabled={tiers.length >= 20}
          onClick={() =>
            setTiers([
              ...tiers,
              {
                index: tiers.length,
                key: `level_${tiers.length + 1}`,
                name: "",
                icon: "🏥",
                hpRequired: (tiers.at(-1)?.hpRequired ?? 0) + 100,
              },
            ])
          }
        >
          <Plus /> Add level
        </Button>
        <Alert variant="info">
          <AlertDescription>
            Raising thresholds never removes unlocks a player already earned; levels and unlocks are
            recalculated from HP.
          </AlertDescription>
        </Alert>
        <SaveBar
          version={meta}
          disabled={JSON.stringify(tiers) === JSON.stringify(value.tiers)}
          loading={save.isPending}
          onSave={(note) =>
            save.mutate({ value: { tiers: tiers.map((t, i) => ({ ...t, index: i })) }, note })
          }
        />
        <SettingHistory settingKey="progression" />
      </CardContent>
    </Card>
  );
}

function HospitalTab() {
  const s = useSetting<HospitalSettings>("hospital");
  return (
    <QueryState query={s}>
      {({ meta, value }) => <HospitalForm key={meta.version} meta={meta} value={value} />}
    </QueryState>
  );
}
function HospitalForm({ meta, value }: { meta: SettingVersion; value: HospitalSettings }) {
  const [f, setF] = useState(value);
  const save = useSaveSetting("hospital", meta);
  const num = (
    k: "unitCost" | "hpPerNeedMet" | "fundingPerNeedMet" | "maxUnitsPerResource",
    label: string,
  ) => (
    <Field id={`h-${k}`} label={label}>
      <Input
        id={`h-${k}`}
        type="number"
        min={0}
        value={f[k]}
        onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })}
      />
    </Field>
  );
  return (
    <Card flat>
      <CardContent className="space-y-4 pt-5">
        <div className="grid gap-4 sm:grid-cols-4">
          {num("unitCost", "Cost per unit (₵)")}
          {num("maxUnitsPerResource", "Max units per resource")}
          {num("hpPerNeedMet", "HP per need covered")}
          {num("fundingPerNeedMet", "Funding per need covered")}
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          {f.resources.map((r, i) => (
            <div key={r.key} className="space-y-2 rounded-xl border-2 border-foreground/15 p-3">
              <div className="text-xs font-bold uppercase text-muted-foreground">{r.key}</div>
              <Input
                aria-label={`${r.key} name`}
                value={r.name}
                onChange={(e) =>
                  setF({
                    ...f,
                    resources: f.resources.map((x, j) =>
                      j === i ? { ...x, name: e.target.value } : x,
                    ),
                  })
                }
              />
              <Input
                aria-label={`${r.key} icon`}
                value={r.icon}
                onChange={(e) =>
                  setF({
                    ...f,
                    resources: f.resources.map((x, j) =>
                      j === i ? { ...x, icon: e.target.value } : x,
                    ),
                  })
                }
              />
            </div>
          ))}
        </div>
        <SaveBar
          version={meta}
          disabled={JSON.stringify(f) === JSON.stringify(value)}
          loading={save.isPending}
          onSave={(note) => save.mutate({ value: f as unknown as Record<string, unknown>, note })}
        />
        <SettingHistory settingKey="hospital" />
      </CardContent>
    </Card>
  );
}

const RES = ["staff", "beds", "ambulances", "supplies"] as const;

function EventsTab() {
  const events = useQuery({
    queryKey: ["admin-hospital-events"],
    queryFn: adminApi.hospitalEvents,
  });
  const [editing, setEditing] = useState<HospitalEvent | "new" | null>(null);
  const canEdit = useCan("catalog:edit");
  return (
    <div className="space-y-3">
      {canEdit && (
        <Button onClick={() => setEditing("new")}>
          <Plus /> New emergency
        </Button>
      )}
      <QueryState
        query={events}
        isEmpty={(d) => d.items.length === 0}
        empty={<EmptyState title="No emergencies configured" />}
      >
        {(d) => (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Emergency</TableHead>
                <TableHead>Needs (S/B/A/Su)</TableHead>
                <TableHead>Weight</TableHead>
                <TableHead>Gating</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.items.map((e) => (
                <TableRow key={e.key}>
                  <TableCell className="max-w-sm">{e.text}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {RES.map((r) => e.needs[r]).join(" / ")}
                  </TableCell>
                  <TableCell>{e.weight}</TableCell>
                  <TableCell className="text-xs">
                    Level ≥ {e.minTierIndex + 1}
                    {e.countryCodes.length ? ` · ${e.countryCodes.join(", ")}` : ""}
                  </TableCell>
                  <TableCell>
                    <Badge variant={e.status === "active" ? "success" : "muted"}>{e.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {canEdit && (
                      <Button size="sm" variant="ghost" onClick={() => setEditing(e)}>
                        Edit
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </QueryState>
      {editing && (
        <EventDialog event={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function EventDialog({ event, onClose }: { event: HospitalEvent | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    key: event?.key ?? "",
    text: event?.text ?? "",
    needs: event?.needs ?? { staff: 1, beds: 1, ambulances: 1, supplies: 1 },
    weight: event?.weight ?? 1,
    minTierIndex: event?.minTierIndex ?? 0,
    countryCodes: event?.countryCodes.join(", ") ?? "",
    status: event?.status ?? "active",
  });
  const save = useApiMutation({
    mutationFn: () => {
      const body = {
        text: f.text.trim(),
        needs: f.needs,
        weight: f.weight,
        minTierIndex: f.minTierIndex,
        countryCodes: f.countryCodes
          .split(",")
          .map((c) => c.trim().toUpperCase())
          .filter(Boolean),
        status: f.status,
      };
      return event
        ? adminApi.updateHospitalEvent(event.key, body)
        : adminApi.createHospitalEvent({ key: f.key.trim(), ...body });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-hospital-events"] });
      onClose();
    },
    successMessage: "Emergency saved",
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{event ? "Edit emergency" : "New emergency"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {!event && (
            <Field
              id="ev-key"
              label="Key"
              hint="lowercase_with_underscores"
              className="sm:col-span-2"
            >
              <Input
                id="ev-key"
                value={f.key}
                onChange={(e) => setF({ ...f, key: e.target.value })}
              />
            </Field>
          )}
          <Field id="ev-text" label="Text shown to players" className="sm:col-span-2">
            <Input
              id="ev-text"
              value={f.text}
              maxLength={200}
              onChange={(e) => setF({ ...f, text: e.target.value })}
            />
          </Field>
          {RES.map((r) => (
            <Field key={r} id={`ev-${r}`} label={`${titleCase(r)} needed`}>
              <Input
                id={`ev-${r}`}
                type="number"
                min={0}
                max={50}
                value={f.needs[r]}
                onChange={(e) => setF({ ...f, needs: { ...f.needs, [r]: Number(e.target.value) } })}
              />
            </Field>
          ))}
          <Field id="ev-weight" label="Weight" hint="Higher = more frequent">
            <Input
              id="ev-weight"
              type="number"
              min={1}
              max={100}
              value={f.weight}
              onChange={(e) => setF({ ...f, weight: Number(e.target.value) })}
            />
          </Field>
          <Field id="ev-tier" label="Minimum level (0-based)">
            <Input
              id="ev-tier"
              type="number"
              min={0}
              max={19}
              value={f.minTierIndex}
              onChange={(e) => setF({ ...f, minTierIndex: Number(e.target.value) })}
            />
          </Field>
          <Field
            id="ev-countries"
            label="Only in countries"
            hint="Comma-separated codes; empty = everywhere"
            className="sm:col-span-2"
          >
            <Input
              id="ev-countries"
              value={f.countryCodes}
              onChange={(e) => setF({ ...f, countryCodes: e.target.value })}
            />
          </Field>
          {event && (
            <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-foreground/15 p-3 sm:col-span-2">
              <label htmlFor="ev-status" className="text-sm font-bold">
                Active
              </label>
              <Switch
                id="ev-status"
                checked={f.status === "active"}
                onCheckedChange={(v) => setF({ ...f, status: v ? "active" : "retired" })}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={save.isPending}
            disabled={f.text.trim().length < 5}
            onClick={() => save.mutate(undefined)}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AchievementsTab() {
  const list = useQuery({ queryKey: ["admin-achievements"], queryFn: adminApi.achievements });
  const [editing, setEditing] = useState<AdminAchievement | "new" | null>(null);
  const canEdit = useCan("catalog:edit");
  return (
    <div className="space-y-3">
      {canEdit && (
        <Button onClick={() => setEditing("new")}>
          <Plus /> New achievement
        </Button>
      )}
      <QueryState
        query={list}
        isEmpty={(d) => d.items.length === 0}
        empty={<EmptyState title="No achievements" />}
      >
        {(d) => (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Achievement</TableHead>
                <TableHead>Criterion</TableHead>
                <TableHead>Rewards</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.items.map((a) => (
                <TableRow key={a.key}>
                  <TableCell>
                    <span aria-hidden="true">{a.icon}</span>{" "}
                    <span className="font-bold">{a.name}</span>
                    <div className="text-xs text-muted-foreground">{a.description}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {titleCase(a.criterion)} ≥ {a.threshold}
                  </TableCell>
                  <TableCell className="text-sm">
                    +{a.rewards.hp} HP · +₵{a.rewards.funding}
                  </TableCell>
                  <TableCell>
                    <Badge variant={a.status === "active" ? "success" : "muted"}>{a.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {canEdit && (
                      <Button size="sm" variant="ghost" onClick={() => setEditing(a)}>
                        Edit
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </QueryState>
      {editing && (
        <AchievementDialog
          a={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function AchievementDialog({ a, onClose }: { a: AdminAchievement | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    key: a?.key ?? "",
    name: a?.name ?? "",
    description: a?.description ?? "",
    icon: a?.icon ?? "🏅",
    criterion: a?.criterion ?? "missions_passed",
    threshold: a?.threshold ?? 1,
    hp: a?.rewards.hp ?? 0,
    funding: a?.rewards.funding ?? 0,
    status: a?.status ?? "active",
  });
  const save = useApiMutation({
    mutationFn: () => {
      const body = {
        name: f.name.trim(),
        description: f.description.trim(),
        icon: f.icon.trim(),
        criterion: f.criterion,
        threshold: f.threshold,
        rewards: { hp: f.hp, funding: f.funding },
        status: f.status,
      };
      return a
        ? adminApi.updateAchievement(a.key, body)
        : adminApi.createAchievement({ key: f.key.trim(), ...body });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-achievements"] });
      onClose();
    },
    successMessage: "Achievement saved",
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{a ? "Edit achievement" : "New achievement"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {!a && (
            <Field id="ac-key" label="Key">
              <Input
                id="ac-key"
                value={f.key}
                onChange={(e) => setF({ ...f, key: e.target.value })}
              />
            </Field>
          )}
          <Field id="ac-name" label="Name">
            <Input
              id="ac-name"
              value={f.name}
              maxLength={60}
              onChange={(e) => setF({ ...f, name: e.target.value })}
            />
          </Field>
          <Field id="ac-icon" label="Icon">
            <Input
              id="ac-icon"
              value={f.icon}
              maxLength={16}
              onChange={(e) => setF({ ...f, icon: e.target.value })}
            />
          </Field>
          <Field id="ac-desc" label="Description" className="sm:col-span-2">
            <Input
              id="ac-desc"
              value={f.description}
              maxLength={200}
              onChange={(e) => setF({ ...f, description: e.target.value })}
            />
          </Field>
          <Field id="ac-crit" label="Criterion">
            <Select
              value={f.criterion}
              onValueChange={(v) => setF({ ...f, criterion: v as typeof f.criterion })}
            >
              <SelectTrigger id="ac-crit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACHIEVEMENT_CRITERIA.map((c) => (
                  <SelectItem key={c} value={c}>
                    {titleCase(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="ac-th" label="Threshold">
            <Input
              id="ac-th"
              type="number"
              min={1}
              value={f.threshold}
              onChange={(e) => setF({ ...f, threshold: Number(e.target.value) })}
            />
          </Field>
          <Field id="ac-hp" label="Bonus HP">
            <Input
              id="ac-hp"
              type="number"
              min={0}
              value={f.hp}
              onChange={(e) => setF({ ...f, hp: Number(e.target.value) })}
            />
          </Field>
          <Field id="ac-fund" label="Bonus funding">
            <Input
              id="ac-fund"
              type="number"
              min={0}
              value={f.funding}
              onChange={(e) => setF({ ...f, funding: Number(e.target.value) })}
            />
          </Field>
          {a && (
            <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-foreground/15 p-3 sm:col-span-2">
              <label htmlFor="ac-status" className="text-sm font-bold">
                Active
              </label>
              <Switch
                id="ac-status"
                checked={f.status === "active"}
                onCheckedChange={(v) => setF({ ...f, status: v ? "active" : "retired" })}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={save.isPending}
            disabled={!f.name.trim() || !f.description.trim()}
            onClick={() => save.mutate(undefined)}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Announcements -----------------------------------------------------------------------------

export function AnnouncementsPage() {
  const [f, setF] = useState({
    title: "",
    body: "",
    route: "",
    roles: [] as string[],
    countries: "",
    push: true,
  });
  const [sent, setSent] = useState<{ recipients: number; pushQueued: number } | null>(null);
  const send = useApiMutation({
    mutationFn: () =>
      adminApi.announce({
        title: f.title.trim(),
        body: f.body.trim(),
        ...(f.route.trim() ? { route: f.route.trim() } : {}),
        audience: {
          ...(f.roles.length ? { roles: f.roles } : {}),
          ...(f.countries.trim()
            ? {
                countries: f.countries
                  .split(",")
                  .map((c) => c.trim().toUpperCase())
                  .filter(Boolean),
              }
            : {}),
        },
        push: f.push,
      }),
    onSuccess: (r) => setSent(r),
    successMessage: (r) => `Sent to ${r.recipients} players`,
  });
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Announcements"
        description="Message players in the app's notification inbox, and by push notification on phones when Firebase is configured."
      />
      {sent && (
        <Alert variant="success">
          <AlertDescription>
            Delivered to {sent.recipients} inboxes · {sent.pushQueued} push notifications queued.
          </AlertDescription>
        </Alert>
      )}
      <Card flat>
        <CardContent className="space-y-4 pt-5">
          <Field id="an-title" label="Title">
            <Input
              id="an-title"
              value={f.title}
              maxLength={80}
              onChange={(e) => setF({ ...f, title: e.target.value })}
            />
          </Field>
          <Field id="an-body" label="Message">
            <Input
              id="an-body"
              value={f.body}
              maxLength={400}
              onChange={(e) => setF({ ...f, body: e.target.value })}
            />
          </Field>
          <Field
            id="an-route"
            label="Open in the app"
            optional
            hint="An in-app path such as /play/story"
          >
            <Input
              id="an-route"
              value={f.route}
              placeholder="/play/story"
              onChange={(e) => setF({ ...f, route: e.target.value })}
            />
          </Field>
          <Field
            id="an-countries"
            label="Only players from countries"
            optional
            hint="Comma-separated codes, e.g. KE, GH (home country in their profile)"
          >
            <Input
              id="an-countries"
              value={f.countries}
              onChange={(e) => setF({ ...f, countries: e.target.value })}
            />
          </Field>
          <fieldset className="space-y-2">
            <legend className="text-sm font-bold">Only these roles (optional)</legend>
            {["player", "reviewer", "admin"].map((r) => (
              <label key={r} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={f.roles.includes(r)}
                  onCheckedChange={(v) =>
                    setF({
                      ...f,
                      roles: v === true ? [...f.roles, r] : f.roles.filter((x) => x !== r),
                    })
                  }
                />
                {titleCase(r)}
              </label>
            ))}
          </fieldset>
          <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-foreground/15 p-3">
            <label htmlFor="an-push" className="text-sm font-bold">
              Also send a push notification (players who allow push)
            </label>
            <Switch
              id="an-push"
              checked={f.push}
              onCheckedChange={(v) => setF({ ...f, push: v })}
            />
          </div>
          <Button
            disabled={f.title.trim().length < 3 || f.body.trim().length < 3}
            onClick={() => setConfirm(true)}
          >
            Send announcement
          </Button>
        </CardContent>
      </Card>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Send this announcement?"
        description="It can't be recalled once delivered."
        confirmLabel="Send"
        loading={send.isPending}
        onConfirm={() => {
          setConfirm(false);
          send.mutate(undefined);
        }}
      />
    </div>
  );
}
