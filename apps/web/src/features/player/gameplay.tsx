import { LEARNER_LEVEL_LABELS, LEARNER_LEVELS } from "@ahq/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Flag, RefreshCw, Sparkles, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Field } from "@/components/common/form";
import { PageHeader } from "@/components/common/page";
import { ErrorState, LoadingState, QueryState } from "@/components/common/states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { aiApi, attemptsApi } from "@/lib/api/missions";
import { playerApi } from "@/lib/api/player";
import type { AnswerResponse, Attempt, Debrief } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { qk, useAiStatus, useInvalidateProgress } from "@/lib/queries";
import { cn } from "@/lib/utils";

type AnsweredStep = Extract<Attempt["steps"][number], { answer: unknown }>;
const isAnswered = (s: Attempt["steps"][number]): s is AnsweredStep => "answer" in s;

// ---- 6 + 7. Clinical gameplay with reasoning input ---------------------------------------------

export function AttemptPage() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const invalidate = useInvalidateProgress();
  const attempt = useQuery({ queryKey: qk.attempt(id), queryFn: () => attemptsApi.get(id) });
  const [reasoning, setReasoning] = useState("");
  const [lastAnswer, setLastAnswer] = useState<AnswerResponse | null>(null);
  const [confirmAbandon, setConfirmAbandon] = useState(false);

  const answer = useMutation({
    mutationFn: (choiceId: string) => {
      const step = attempt.data!.steps[attempt.data!.currentStepIndex!]!;
      return attemptsApi.answer(id, {
        stepId: step.stepId,
        choiceId,
        ...(reasoning.trim() ? { reasoning: reasoning.trim() } : {}),
      });
    },
    onSuccess: (res) => {
      // Merge the authoritative answer into the cached attempt (no flicker while refetching).
      qc.setQueryData<Attempt>(qk.attempt(id), (a) => {
        if (!a) return a;
        const steps: Attempt["steps"] = a.steps.map((s) =>
          s.stepId === res.step.stepId ? res.step : s,
        );
        if (res.next && !steps.some((s) => s.stepId === res.next!.stepId)) steps.push(res.next);
        return {
          ...a,
          steps,
          currentStepIndex: res.next ? res.next.index : null,
          status: res.result ? "completed" : a.status,
          result: res.result
            ? {
                score: res.result.score,
                maxScore: res.result.maxScore,
                passed: res.result.passed,
                rewards: res.result.rewards,
              }
            : a.result,
        };
      });
      setLastAnswer(res);
      setReasoning("");
      if (res.result) {
        void invalidate();
        for (const a of res.result.achievements) toast.success(`Achievement unlocked: ${a.name}`);
      }
    },
    onError: (e) => {
      toast.error(errorMessage(e));
      // Another device may have answered; reload the authoritative state.
      void qc.invalidateQueries({ queryKey: qk.attempt(id) });
    },
  });
  const abandon = useMutation({
    mutationFn: () => attemptsApi.abandon(id),
    onSuccess: () => {
      void invalidate();
      navigate("/play");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <QueryState query={attempt}>
        {(a) => {
          const current =
            a.currentStepIndex != null && !lastAnswer?.result
              ? a.steps[a.currentStepIndex]
              : undefined;
          const showingFeedback =
            lastAnswer &&
            !lastAnswer.result &&
            current &&
            lastAnswer.step.stepId !== current.stepId;
          const answered = a.steps.filter(isAnswered);
          return (
            <>
              <PageHeader
                back={{ to: a.mode === "practice" ? "/play/challenge" : "/play/story" }}
                title={
                  <span className="flex items-center gap-3">
                    <span aria-hidden="true">{a.icon}</span> {a.title}
                  </span>
                }
                actions={
                  a.status === "in_progress" ? (
                    <Button variant="ghost" size="sm" onClick={() => setConfirmAbandon(true)}>
                      Leave case
                    </Button>
                  ) : undefined
                }
                eyebrow={a.mode === "practice" ? "Clinical Challenge · practice" : "Story Mode"}
              />
              <Card>
                <CardContent className="space-y-3 pt-5">
                  <p className="text-lg leading-relaxed" data-testid="case-story">
                    {a.story}
                  </p>
                  {a.status === "in_progress" && a.currentStepIndex != null && (
                    <p className="font-display text-lg font-extrabold" aria-live="polite">
                      Step {a.currentStepIndex + 1}/{a.stepCount}:{" "}
                      {a.steps[a.currentStepIndex]?.prompt}
                    </p>
                  )}
                </CardContent>
              </Card>

              {answered.length > 0 && (
                <ol className="mt-6 space-y-3" aria-label="Your decisions">
                  {answered.map((s) => (
                    <AnsweredStepCard
                      key={s.stepId}
                      step={s}
                      highlight={lastAnswer?.step.stepId === s.stepId}
                    />
                  ))}
                </ol>
              )}

              {a.status === "in_progress" &&
                current &&
                !showingFeedback &&
                !isAnswered(current) && (
                  <div className="mt-6 space-y-4">
                    <Field
                      id="reasoning"
                      label={
                        <>
                          Your clinical reasoning{" "}
                          <span className="font-normal text-muted-foreground">
                            (optional, used for your AI debrief)
                          </span>
                        </>
                      }
                      hint="Don't include names or details that could identify a real patient."
                    >
                      <Textarea
                        id="reasoning"
                        placeholder="Why would you choose this? What are you thinking?"
                        value={reasoning}
                        maxLength={1500}
                        onChange={(e) => setReasoning(e.target.value)}
                      />
                    </Field>
                    <div className="space-y-3" role="group" aria-label="Choices">
                      {current.choices.map((c) => (
                        <button
                          key={c.choiceId}
                          className="pressable block w-full rounded-2xl border-2 border-foreground bg-card p-4 text-left font-bold shadow-pop-sm transition-colors hover:bg-muted disabled:opacity-60"
                          disabled={answer.isPending}
                          onClick={() => answer.mutate(c.choiceId)}
                          data-testid="choice"
                        >
                          {c.text}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              {a.status === "in_progress" && showingFeedback && (
                <Button
                  size="lg"
                  variant="game"
                  className="mt-6 w-full"
                  onClick={() => setLastAnswer(null)}
                >
                  Next step →
                </Button>
              )}

              {(lastAnswer?.result || a.status === "completed") && (
                <ResultPanel attempt={a} live={lastAnswer?.result ?? null} />
              )}
              {a.status === "abandoned" && (
                <Alert variant="warning" className="mt-6">
                  <AlertDescription>
                    You left this case. Start it again from the mission page.
                  </AlertDescription>
                </Alert>
              )}
              {a.status === "expired" && (
                <Alert variant="warning" className="mt-6">
                  <AlertDescription>
                    This case expired after a long break. Start it again any time.
                  </AlertDescription>
                </Alert>
              )}
              <ConfirmDialog
                open={confirmAbandon}
                onOpenChange={setConfirmAbandon}
                title="Leave this case?"
                description="Your answers so far are kept in your history, but you won't earn rewards for this attempt."
                confirmLabel="Leave case"
                variant="destructive"
                loading={abandon.isPending}
                onConfirm={() => abandon.mutate()}
              />
            </>
          );
        }}
      </QueryState>
    </div>
  );
}

function AnsweredStepCard({ step, highlight }: { step: AnsweredStep; highlight?: boolean }) {
  const chosen = step.choices.find((c) => c.choiceId === step.answer.choiceId);
  const correct = step.choices.find((c) => c.choiceId === step.answer.correctChoiceId);
  return (
    <li
      className={cn(
        "rounded-2xl border-2 p-4",
        step.answer.correct
          ? "border-success bg-success/10"
          : "border-destructive/60 bg-destructive/5",
        highlight && "animate-in fade-in-0 slide-in-from-bottom-2",
      )}
      data-testid="answered-step"
    >
      <div className="text-sm font-bold text-muted-foreground">
        Step {step.index + 1}: {step.prompt}
      </div>
      <div className="mt-1 flex items-start gap-2 font-bold">
        {step.answer.correct ? (
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
        ) : (
          <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
        )}
        <span>
          {chosen?.text} — {step.answer.correct ? "Correct" : "Not the best choice"}
        </span>
      </div>
      <p className="mt-2">{step.answer.feedback}</p>
      {!step.answer.correct && correct && (
        <p className="mt-2 text-sm">
          <span className="font-bold">Best answer:</span> {correct.text}
        </p>
      )}
      {step.answer.critical && (
        <Alert variant="destructive" className="mt-3">
          <AlertTriangle className="size-4" />
          <AlertTitle>Dangerous choice</AlertTitle>
          <AlertDescription>
            Clinicians flagged this option as a critical error that could seriously harm a patient.
          </AlertDescription>
        </Alert>
      )}
      {step.answer.reasoning && (
        <p className="mt-2 text-sm italic text-muted-foreground">
          Your reasoning: "{step.answer.reasoning}"
        </p>
      )}
    </li>
  );
}

function ResultPanel({ attempt, live }: { attempt: Attempt; live: AnswerResponse["result"] }) {
  const passed = live?.passed ?? attempt.result?.passed ?? false;
  const score = live?.score ?? attempt.result?.score ?? 0;
  const maxScore = live?.maxScore ?? attempt.result?.maxScore ?? 0;
  const rewards = live?.rewards ?? attempt.result?.rewards ?? { hp: 0, funding: 0 };
  return (
    <div className="mt-6 space-y-6" data-testid="attempt-result">
      <Card>
        <CardContent className="space-y-3 pt-6 text-center">
          <div className="text-6xl" aria-hidden="true">
            {passed ? "🎉" : "💔"}
          </div>
          <h2 className="text-3xl font-extrabold" aria-live="polite">
            {passed ? "Patient saved!" : "The patient needed better care"}
          </h2>
          <p className="text-muted-foreground">
            Score {score}/{maxScore}
            {attempt.mode === "practice" ? " · practice — no rewards" : ""}
          </p>
          {attempt.mode === "story" && (
            <div className="flex justify-center gap-2">
              <Badge variant="default">+{rewards.hp} Health Points</Badge>
              <Badge variant="secondary">+₵{rewards.funding}</Badge>
            </div>
          )}
          {live?.criticalError && (
            <p className="text-sm font-bold text-destructive">
              A critical error ended this case — review the flagged step above.
            </p>
          )}
          {live &&
            (live.newlyUnlocked.tiers.length > 0 || live.newlyUnlocked.countries.length > 0) && (
              <Alert variant="success" className="text-left">
                <AlertTitle>New unlocks!</AlertTitle>
                <AlertDescription>
                  {live.newlyUnlocked.tiers.map((t) => `${t.icon} ${t.name}`).join(", ")}
                  {live.newlyUnlocked.tiers.length && live.newlyUnlocked.countries.length
                    ? " · "
                    : ""}
                  {live.newlyUnlocked.countries.length
                    ? `Countries: ${live.newlyUnlocked.countries.join(", ")}`
                    : ""}
                </AlertDescription>
              </Alert>
            )}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild variant="game" size="lg">
              <Link to={attempt.mode === "practice" ? "/play/challenge" : "/play/story"}>
                Continue
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to={`/play/missions/${attempt.missionKey}`}>Play again</Link>
            </Button>
          </div>
          {live?.verification && (
            <p className="text-xs text-muted-foreground">
              Case approved by {live.verification.reviewerName} ({live.verification.credentials}).
            </p>
          )}
        </CardContent>
      </Card>
      <DebriefPanel attemptId={attempt.id} />
    </div>
  );
}

// ---- 8. AI debrief -----------------------------------------------------------------------------

export function DebriefPanel({ attemptId }: { attemptId: string }) {
  const qc = useQueryClient();
  const status = useAiStatus();
  const profile = useQuery({ queryKey: qk.profile, queryFn: playerApi.profile });
  const list = useQuery({ queryKey: qk.debriefs(attemptId), queryFn: () => aiApi.list(attemptId) });
  const [levelChoice, setLevel] = useState<string>("");
  const level = levelChoice || profile.data?.learnerLevel || "";
  const [consentOpen, setConsentOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const current: Debrief | undefined =
    list.data?.items.find((d) => d.id === pendingId) ??
    list.data?.items.find((d) => d.status !== "failed") ??
    list.data?.items[0];

  // Poll a pending debrief every 3 s (up to ~90 s) — generation continues on the server.
  const poll = useQuery({
    queryKey: ["debrief", pendingId],
    queryFn: () => aiApi.get(pendingId!),
    enabled: Boolean(pendingId),
    refetchInterval: (q) =>
      q.state.data?.status === "pending" && q.state.dataUpdateCount < 30 ? 3000 : false,
  });
  useEffect(() => {
    if (poll.data && poll.data.status !== "pending") {
      void qc.invalidateQueries({ queryKey: qk.debriefs(attemptId) });
      void qc.invalidateQueries({ queryKey: qk.aiStatus });
    }
  }, [poll.data, qc, attemptId]);

  const request = useMutation({
    mutationFn: (regenerate: boolean) => aiApi.request(attemptId, level, regenerate),
    onSuccess: (d) => {
      setPendingId(d.id);
      void qc.invalidateQueries({ queryKey: qk.debriefs(attemptId) });
      void qc.invalidateQueries({ queryKey: qk.aiStatus });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "PRECONDITION_FAILED") setConsentOpen(true);
    },
  });
  const consent = useMutation({
    mutationFn: aiApi.consent,
    onSuccess: () => {
      setConsentOpen(false);
      void qc.invalidateQueries({ queryKey: qk.aiStatus });
      request.mutate(false);
    },
  });
  const ask = (regenerate = false) => {
    if (status.data?.consentRequired) setConsentOpen(true);
    else request.mutate(regenerate);
  };
  const shown = poll.data && poll.data.id === current?.id ? poll.data : current;
  const requestError =
    request.error instanceof ApiError && request.error.code !== "PRECONDITION_FAILED"
      ? request.error
      : null;

  return (
    <Card data-testid="debrief-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">🧠 AI Learning Debrief</CardTitle>
        <CardDescription>Personalised feedback on your decisions and reasoning.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status.data && !status.data.enabled && !shown && (
          <Alert variant="info">
            <AlertDescription>
              Debriefs are resting right now. Your results are saved — try again later.
            </AlertDescription>
          </Alert>
        )}
        {(!shown || shown.status === "failed") && (status.data?.enabled ?? true) && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="debrief-level">Your level</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger id="debrief-level">
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
            </div>
            <Button
              variant="secondary"
              disabled={!level}
              loading={request.isPending}
              onClick={() => ask(false)}
            >
              <Sparkles /> Get debrief
            </Button>
          </div>
        )}
        {status.data && (
          <p className="text-xs text-muted-foreground">
            {status.data.used}/{status.data.limit} debriefs used today · For education only — not
            medical advice.
          </p>
        )}
        {requestError && (
          <Alert variant={requestError.status === 429 ? "warning" : "destructive"}>
            <AlertDescription>{requestError.message}</AlertDescription>
          </Alert>
        )}
        {list.isPending ? (
          <LoadingState rows={1} />
        ) : list.isError ? (
          <ErrorState error={list.error} />
        ) : null}
        {shown && (
          <DebriefView
            debrief={shown}
            onRegenerate={() => ask(true)}
            regenerating={request.isPending}
          />
        )}
      </CardContent>
      <Dialog open={consentOpen} onOpenChange={setConsentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Before your first debrief</DialogTitle>
            <DialogDescription>
              AI debriefs are generated by Anthropic's Claude model on our servers.
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1.5 pl-5 text-sm">
            <li>
              We send the case, your choices and your written reasoning — never your name, email or
              account details.
            </li>
            <li>The request may be processed outside your country.</li>
            <li>Feedback is educational only and is not medical advice for a real patient.</li>
          </ul>
          {consent.isError && (
            <p className="text-sm text-destructive">{errorMessage(consent.error)}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConsentOpen(false)}>
              Not now
            </Button>
            <Button loading={consent.isPending} onClick={() => consent.mutate()}>
              I agree — get my debrief
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

const FAILURE_TEXT: Record<string, string> = {
  provider_unavailable:
    "The AI service is busy. Try again in a minute — this didn't use up your daily debriefs.",
  refused:
    "We couldn't generate feedback for this case. This didn't count against your daily limit.",
  invalid_output:
    "We couldn't generate feedback for this case. This didn't count against your daily limit.",
  interrupted: "Generation was interrupted. Please try again.",
};

function DebriefView({
  debrief,
  onRegenerate,
  regenerating,
}: {
  debrief: Debrief;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  const [flagOpen, setFlagOpen] = useState(false);
  const flag = useMutation({
    mutationFn: (reason: string) => aiApi.flag(debrief.id, "inaccurate", reason),
    onSuccess: (r) => {
      toast.success(r.message);
      setFlagOpen(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (debrief.status === "pending") {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-muted p-4" role="status">
        <RefreshCw className="size-5 animate-spin" /> Writing your debrief… this can take up to a
        minute.
      </div>
    );
  }
  if (debrief.status === "failed") {
    return (
      <Alert variant="warning">
        <AlertDescription>{FAILURE_TEXT[debrief.failureReason ?? "interrupted"]}</AlertDescription>
      </Alert>
    );
  }
  return (
    <article className="space-y-5" data-testid="debrief" aria-label="Your debrief">
      <p
        className="flex items-start gap-2 rounded-xl border-2 border-accent bg-accent/25 p-3 text-sm"
        data-testid="ai-label"
      >
        <Sparkles className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          <strong>AI-generated educational feedback.</strong> It explains the clinician-approved
          answers for this case and does not replace teaching from qualified clinical instructors.
        </span>
      </p>
      <section>
        <h3 className="text-lg font-extrabold">Overall</h3>
        <p className="mt-1 leading-relaxed">{debrief.overall}</p>
      </section>
      <section>
        <h3 className="text-lg font-extrabold">Decision by decision</h3>
        <ol className="mt-2 space-y-3">
          {debrief.decisions.map((d, i) => (
            <li key={d.stepId} className="rounded-xl border-2 border-foreground/15 p-3">
              <div className="flex items-start gap-2 text-sm font-bold">
                {d.correct ? (
                  <CheckCircle2 className="size-4 shrink-0 text-success" />
                ) : (
                  <XCircle className="size-4 shrink-0 text-destructive" />
                )}
                <span>
                  Step {i + 1}: {d.prompt} — you chose "{d.chosenText}"
                </span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed">{d.explanation}</p>
            </li>
          ))}
        </ol>
      </section>
      {(debrief.strengths.length > 0 || debrief.knowledgeGaps.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {debrief.strengths.length > 0 && (
            <section>
              <h3 className="text-lg font-extrabold">Strengths</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {debrief.strengths.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </section>
          )}
          {debrief.knowledgeGaps.length > 0 && (
            <section>
              <h3 className="text-lg font-extrabold">Knowledge gaps</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {debrief.knowledgeGaps.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
      <section>
        <h3 className="text-lg font-extrabold">Key teaching points</h3>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          {debrief.teachingPoints.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>
      {debrief.recommendedTopics.length > 0 && (
        <section>
          <h3 className="text-lg font-extrabold">Recommended topics</h3>
          <ul className="mt-1 space-y-1.5">
            {debrief.recommendedTopics.map((t) => (
              <li key={t.topic} className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="secondary">{t.topic}</Badge>
                {t.missions.map((m) => (
                  <Link
                    key={m.key}
                    to={`/play/missions/${m.key}`}
                    className="font-semibold text-primary underline underline-offset-2"
                  >
                    {m.title}
                  </Link>
                ))}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h3 className="text-lg font-extrabold">Practice next</h3>
        <ol className="mt-1 list-decimal space-y-1 pl-5">
          {debrief.practiceQuestions.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ol>
      </section>
      {debrief.references.length > 0 && (
        <section>
          <h3 className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
            Clinician-approved references
          </h3>
          <ul className="mt-1 space-y-1 text-sm">
            {debrief.references.map((r) => (
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
        </section>
      )}
      <p className="text-xs text-muted-foreground">
        {debrief.disclaimer} Generated {formatDateTime(debrief.completedAt)} for{" "}
        {LEARNER_LEVEL_LABELS[debrief.level]}.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" loading={regenerating} onClick={onRegenerate}>
          <RefreshCw /> New debrief
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setFlagOpen(true)}>
          <Flag /> Report a problem
        </Button>
      </div>
      <ConfirmDialog
        open={flagOpen}
        onOpenChange={setFlagOpen}
        title="Report this debrief"
        description="A clinician will review it. Tell us what looks wrong or unsafe."
        requireReason
        reasonLabel="What's wrong?"
        confirmLabel="Send report"
        loading={flag.isPending}
        onConfirm={(r) => flag.mutate(r)}
      />
    </article>
  );
}
