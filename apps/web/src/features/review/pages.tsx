import { CLINICIAN_PROFESSIONS, REFERENCE_TYPES } from "@ahq/api-contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileUp,
  Plus,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { RequireRegistered } from "@/app/guards";
import { Field } from "@/components/common/form";
import { PageHeader, Pagination, StatCard } from "@/components/common/page";
import { EmptyState, LoadingState, QueryState } from "@/components/common/states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { clinicianApi, reviewApi } from "@/lib/api/review";
import type {
  FullReference,
  FullVersion,
  ReviewQueuePage,
  ReviewVersionDetail,
} from "@/lib/api/types";
import { useCan } from "@/lib/auth/permissions";
import {
  formatDate,
  formatDateTime,
  learnerLevelLabel,
  relativeTime,
  titleCase,
} from "@/lib/format";
import { useCountries } from "@/lib/queries";
import { cn } from "@/lib/utils";

const STATUS_VARIANT: Record<string, "accent" | "success" | "outline" | "muted" | "destructive"> = {
  in_review: "accent",
  published: "success",
  approved: "success",
  changes_requested: "destructive",
  draft: "muted",
  superseded: "muted",
  withdrawn: "outline",
};
export function VersionStatus({ status }: { status: string }) {
  return <Badge variant={STATUS_VARIANT[status] ?? "outline"}>{titleCase(status)}</Badge>;
}

function QueueTable({ page, empty }: { page: ReviewQueuePage; empty: string }) {
  if (!page.items.length) return <EmptyState icon="✅" title={empty} />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Case</TableHead>
          <TableHead>Version</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Submitted</TableHead>
          <TableHead>Reviewers</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {page.items.map((v) => (
          <TableRow key={v.versionId}>
            <TableCell>
              <div className="font-bold">{v.title}</div>
              <div className="text-xs text-muted-foreground">
                {v.missionKey} · {v.countryCode}
                {v.isUpdate ? " · update to a published case" : " · new case"}
              </div>
            </TableCell>
            <TableCell>v{v.versionNumber}</TableCell>
            <TableCell>
              <VersionStatus status={v.status} />
            </TableCell>
            <TableCell className="whitespace-nowrap">
              {v.submittedAt ? relativeTime(v.submittedAt) : "—"}
            </TableCell>
            <TableCell className="text-sm">
              {v.assignedToMe && <Badge variant="accent">You</Badge>}{" "}
              {v.assignees
                .filter((a) => !v.assignedToMe || a.name)
                .map((a) => a.name)
                .join(", ") || (v.assignedToMe ? "" : "Unassigned")}
            </TableCell>
            <TableCell className="text-right">
              <Button asChild size="sm" variant="outline">
                <Link to={`/review/versions/${v.versionId}`}>Open</Link>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ---- Reviewer dashboard ------------------------------------------------------------------------

export function ReviewDashboardPage() {
  const mine = useQuery({
    queryKey: ["review-queue", "me"],
    queryFn: () => reviewApi.queue({ assigned: "me", pageSize: 5 }),
  });
  const all = useQuery({
    queryKey: ["review-queue", "any", 1],
    queryFn: () => reviewApi.queue({ pageSize: 5 }),
  });
  const flags = useQuery({ queryKey: ["ai-flags"], queryFn: reviewApi.aiFlags });
  const profile = useQuery({
    queryKey: ["clinician-profile"],
    queryFn: clinicianApi.profile,
    retry: false,
  });
  const canDecide = useCan("review:decide");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reviewer dashboard"
        description="Cases reach players only after a verified clinician approves them."
      />
      {!canDecide && (
        <Alert variant="info">
          <AlertDescription>
            You can read cases here, but approving requires the clinician reviewer role with
            verified credentials.
          </AlertDescription>
        </Alert>
      )}
      {profile.data && profile.data.status !== "verified" && (
        <Alert variant="warning">
          <AlertDescription>
            Your credentials are{" "}
            {profile.data.status === "pending" ? "awaiting verification" : "not verified"}.{" "}
            <Link to="/review/profile" className="font-bold underline">
              View profile
            </Link>
          </AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Assigned to me" value={mine.data?.total ?? "…"} />
        <StatCard label="Awaiting review" value={all.data?.total ?? "…"} />
        <StatCard label="Reported debriefs" value={flags.data?.items.length ?? "…"} />
      </div>
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-extrabold">Assigned to me</h2>
          <Button asChild variant="link">
            <Link to="/review/assignments">See all</Link>
          </Button>
        </div>
        <QueryState query={mine}>
          {(d) => <QueueTable page={d} empty="Nothing assigned to you right now" />}
        </QueryState>
      </section>
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-extrabold">Awaiting review</h2>
          <Button asChild variant="link">
            <Link to="/review/queue">Open queue</Link>
          </Button>
        </div>
        <QueryState query={all}>
          {(d) => <QueueTable page={d} empty="The review queue is empty" />}
        </QueryState>
      </section>
    </div>
  );
}

// ---- Assigned missions -------------------------------------------------------------------------

export function AssignmentsPage() {
  const [page, setPage] = useState(1);
  const queue = useQuery({
    queryKey: ["review-queue", "me", page],
    queryFn: () => reviewApi.queue({ assigned: "me", page }),
  });
  const assignments = useQuery({
    queryKey: ["review-assignments"],
    queryFn: reviewApi.assignments,
  });
  return (
    <div>
      <PageHeader
        title="Assigned to me"
        description="Cases an administrator asked you to review."
      />
      <QueryState query={queue}>
        {(d) => (
          <>
            <QueueTable page={d} empty="No open assignments" />
            <Pagination page={page} pageSize={d.pageSize} total={d.total} onPage={setPage} />
          </>
        )}
      </QueryState>
      {assignments.data && assignments.data.items.some((a) => a.dueAt) && (
        <Card flat className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Due dates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {assignments.data.items
              .filter((a) => a.dueAt)
              .map((a) => (
                <div key={a.id}>
                  {a.missionKey} v{a.versionNumber} — due {formatDate(a.dueAt)}
                </div>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---- Queue -------------------------------------------------------------------------------------

export function QueuePage() {
  const [status, setStatus] = useState("in_review");
  const [page, setPage] = useState(1);
  const queue = useQuery({
    queryKey: ["review-queue", "any", status, page],
    queryFn: () => reviewApi.queue({ status, page }),
  });
  return (
    <div>
      <PageHeader title="Review queue" />
      <Tabs
        value={status}
        onValueChange={(v) => {
          setStatus(v);
          setPage(1);
        }}
      >
        <TabsList>
          <TabsTrigger value="in_review">Awaiting review</TabsTrigger>
          <TabsTrigger value="changes_requested">Changes requested</TabsTrigger>
          <TabsTrigger value="published">Published</TabsTrigger>
        </TabsList>
        <TabsContent value={status}>
          <QueryState query={queue}>
            {(d) => (
              <>
                <QueueTable page={d} empty="Nothing here" />
                <Pagination page={page} pageSize={d.pageSize} total={d.total} onPage={setPage} />
              </>
            )}
          </QueryState>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---- Clinical scenario inspection, treatment review, reference verification, decision ----------

export function ReviewVersionPage() {
  const { id = "" } = useParams();
  const detail = useQuery({
    queryKey: ["review-version", id],
    queryFn: () => reviewApi.version(id),
  });
  return (
    <div className="mx-auto max-w-5xl">
      <QueryState query={detail}>
        {(d) => (
          <>
            <PageHeader
              back={{ to: "/review/queue", label: "Review queue" }}
              eyebrow={`${d.version.missionKey} · version ${d.version.versionNumber}`}
              title={d.version.content.title}
              actions={<VersionStatus status={d.version.status} />}
            />
            <Tabs defaultValue="scenario">
              <TabsList>
                <TabsTrigger value="scenario">1. Scenario</TabsTrigger>
                <TabsTrigger value="treatment">2. Treatment</TabsTrigger>
                <TabsTrigger value="changes">
                  Changes ({d.diffFromPublished.changes.length})
                </TabsTrigger>
                <TabsTrigger value="history">History ({d.reviews.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="scenario">
                <ScenarioView v={d.version} />
              </TabsContent>
              <TabsContent value="treatment">
                <TreatmentView v={d.version} />
              </TabsContent>
              <TabsContent value="changes">
                <DiffView d={d} />
              </TabsContent>
              <TabsContent value="history">
                <ReviewsList reviews={d.reviews} />
              </TabsContent>
            </Tabs>
            <DecisionCard d={d} />
          </>
        )}
      </QueryState>
    </div>
  );
}

function ScenarioView({ v }: { v: FullVersion }) {
  return (
    <Card flat>
      <CardContent className="space-y-4 pt-5">
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant="muted">Country {v.content.countryCode}</Badge>
          <Badge variant="muted">{v.content.steps.length} steps</Badge>
          {v.basedOnVersionNumber && (
            <Badge variant="muted">Based on v{v.basedOnVersionNumber}</Badge>
          )}
        </div>
        <p className="whitespace-pre-line text-lg leading-relaxed">{v.content.story}</p>
        {v.content.learningObjectives.length > 0 && (
          <div>
            <h3 className="font-extrabold">Learning objectives</h3>
            <ul className="list-disc pl-5">
              {v.content.learningObjectives.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </div>
        )}
        {v.changeSummary && (
          <Alert variant="info">
            <AlertTitle>Author's change summary</AlertTitle>
            <AlertDescription>{v.changeSummary}</AlertDescription>
          </Alert>
        )}
        <p className="text-xs text-muted-foreground">
          Content hash <code className="break-all">{v.contentHash}</code> · submitted{" "}
          {formatDateTime(v.submittedAt)}
        </p>
      </CardContent>
    </Card>
  );
}

function TreatmentView({ v }: { v: FullVersion }) {
  return (
    <ol className="space-y-4">
      {v.content.steps.map((s, i) => (
        <li key={s.stepId}>
          <Card flat>
            <CardHeader>
              <CardTitle className="text-base">
                Step {i + 1}: {s.prompt}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {s.choices.map((c) => (
                <div
                  key={c.choiceId}
                  className={cn(
                    "rounded-xl border-2 p-3",
                    c.correct
                      ? "border-success bg-success/10"
                      : c.critical
                        ? "border-destructive bg-destructive/5"
                        : "border-foreground/15",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2 font-bold">
                    {c.correct ? (
                      <CheckCircle2 className="size-4 text-success" />
                    ) : (
                      <XCircle className="size-4 text-muted-foreground" />
                    )}
                    {c.text}
                    {c.correct && <Badge variant="success">Official answer</Badge>}
                    {c.critical && (
                      <Badge variant="destructive">
                        <AlertTriangle className="size-3" /> Critical error
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">Feedback: {c.feedback}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </li>
      ))}
    </ol>
  );
}

function DiffView({ d }: { d: ReviewVersionDetail }) {
  if (d.diffFromPublished.against == null)
    return (
      <EmptyState title="New case" description="There is no published version to compare with." />
    );
  if (!d.diffFromPublished.changes.length)
    return (
      <EmptyState
        title="No content changes"
        description={`Identical to published v${d.diffFromPublished.against}.`}
      />
    );
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Compared with published v{d.diffFromPublished.against}.
      </p>
      {d.diffFromPublished.changes.map((c) => (
        <div key={c.path} className="rounded-xl border-2 border-foreground/15 p-3 text-sm">
          <code className="font-bold">{c.path}</code>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg bg-destructive/10 p-2">
              <span className="font-bold">Before: </span>
              {JSON.stringify(c.before)}
            </div>
            <div className="rounded-lg bg-success/10 p-2">
              <span className="font-bold">After: </span>
              {JSON.stringify(c.after)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReviewsList({ reviews }: { reviews: ReviewVersionDetail["reviews"] }) {
  if (!reviews.length) return <EmptyState title="No reviews yet" />;
  return (
    <ul className="space-y-3">
      {reviews.map((r) => (
        <li key={r.id} className="rounded-xl border-2 border-foreground/15 bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={r.decision === "approved" ? "success" : "destructive"}>
              {titleCase(r.decision)}
            </Badge>
            <span className="font-bold">
              {r.reviewer.name} ({r.reviewer.credentials})
            </span>
            <span className="text-sm text-muted-foreground">
              v{r.versionNumber} · {formatDateTime(r.createdAt)}
            </span>
          </div>
          {r.notes && <p className="mt-2 whitespace-pre-line text-sm">{r.notes}</p>}
          {r.references.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              References: {r.references.map((x) => x.title).join("; ")}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function DecisionCard({ d }: { d: ReviewVersionDetail }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [checks, setChecks] = useState({ scenario: false, treatment: false, references: false });
  const [refIds, setRefIds] = useState<string[]>(() => d.version.references.map((r) => r.id));
  const [notes, setNotes] = useState("");
  const [pickOpen, setPickOpen] = useState(false);
  const refs = useQuery({
    queryKey: ["references", "all-active"],
    queryFn: () => reviewApi.references({ status: "active", pageSize: 100 }),
  });
  const selected = useMemo(
    () => (refs.data?.items ?? []).filter((r) => refIds.includes(r.id)),
    [refs.data, refIds],
  );
  const decide = useMutation({
    mutationFn: (decision: "approved" | "changes_requested") =>
      reviewApi.decide(d.version.id, {
        decision,
        contentHash: d.version.contentHash!,
        checks,
        referenceIds: refIds,
        notes: notes.trim(),
      }),
    onSuccess: (r) => {
      toast.success(r.decision === "approved" ? "Approved and published" : "Changes requested");
      void qc.invalidateQueries({ queryKey: ["review-queue"] });
      navigate("/review/queue");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (d.version.status !== "in_review") return null;
  if (!d.canDecide) {
    return (
      <Alert variant="info" className="mt-6">
        <AlertTitle>You can't decide on this version</AlertTitle>
        <AlertDescription>
          {d.cannotDecideReason ?? "Only verified clinician reviewers can approve cases."}
        </AlertDescription>
      </Alert>
    );
  }
  const allChecked = checks.scenario && checks.treatment && checks.references;
  const canApprove = allChecked && refIds.length > 0;
  return (
    <Card className="mt-8" data-testid="decision-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-5" /> Your decision
        </CardTitle>
        <CardDescription>
          Approving publishes this exact version (hash-checked). Any later edit needs a new review.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <fieldset className="space-y-3">
          <legend className="mb-2 font-extrabold">Checks</legend>
          {(
            [
              ["scenario", "The scenario is clinically realistic and appropriate for the setting."],
              [
                "treatment",
                "The official answers, feedback and critical-error flags are correct and safe.",
              ],
              ["references", "The references support the answers and are current."],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="flex items-start gap-3 text-sm">
              <Checkbox
                checked={checks[k]}
                onCheckedChange={(v) => setChecks({ ...checks, [k]: v === true })}
                className="mt-0.5"
              />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold">Supporting references ({refIds.length})</h3>
            <Button size="sm" variant="outline" onClick={() => setPickOpen(true)}>
              Choose references
            </Button>
          </div>
          {selected.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              At least one verified reference is required to approve.
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {selected.map((r) => (
                <li key={r.id} className="flex items-center gap-2">
                  <ReferenceLine r={r} />
                </li>
              ))}
            </ul>
          )}
        </div>
        <Field
          id="notes"
          label="Notes"
          hint="Required when requesting changes (at least 10 characters)."
        >
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={4000}
          />
        </Field>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="secondary"
            disabled={!canApprove}
            loading={decide.isPending && decide.variables === "approved"}
            onClick={() => decide.mutate("approved")}
          >
            <CheckCircle2 /> Approve and publish
          </Button>
          <Button
            variant="destructive"
            disabled={notes.trim().length < 10}
            loading={decide.isPending && decide.variables === "changes_requested"}
            onClick={() => decide.mutate("changes_requested")}
          >
            Request changes
          </Button>
        </div>
      </CardContent>
      <Dialog open={pickOpen} onOpenChange={setPickOpen}>
        <DialogContent className="max-w-2xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Choose references</DialogTitle>
          </DialogHeader>
          {refs.isPending ? (
            <LoadingState rows={2} />
          ) : (
            <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
              {(refs.data?.items ?? []).map((r) => (
                <li key={r.id}>
                  <label className="flex items-start gap-3 rounded-xl border-2 border-foreground/15 p-3 text-sm">
                    <Checkbox
                      checked={refIds.includes(r.id)}
                      onCheckedChange={(v) =>
                        setRefIds((ids) =>
                          v === true ? [...ids, r.id] : ids.filter((x) => x !== r.id),
                        )
                      }
                    />
                    <ReferenceLine r={r} />
                  </label>
                </li>
              ))}
              {refs.data?.items.length === 0 && (
                <EmptyState
                  title="The library is empty"
                  description="Add references from the References page."
                />
              )}
            </ul>
          )}
          <DialogFooter>
            <Button asChild variant="outline">
              <Link to="/review/references">Manage library</Link>
            </Button>
            <Button onClick={() => setPickOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ReferenceLine({ r }: { r: FullReference }) {
  return (
    <span className="min-w-0">
      <span className="font-bold">{r.title}</span>
      {r.organization ? ` — ${r.organization}` : ""}
      {r.year ? ` (${r.year})` : ""}{" "}
      {r.lastVerifiedAt ? (
        <Badge variant="success">Verified {formatDate(r.lastVerifiedAt)}</Badge>
      ) : (
        <Badge variant="outline">Not verified</Badge>
      )}
      {r.url && (
        <a
          href={r.url}
          target="_blank"
          rel="noreferrer noopener"
          className="ml-1 inline-flex items-center text-primary"
          aria-label="Open reference"
        >
          <ExternalLink className="size-3.5" />
        </a>
      )}
    </span>
  );
}

// ---- Reference verification (library) ----------------------------------------------------------

export function ReferencesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("active");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<FullReference | "new" | null>(null);
  const canEdit = useCan("references:edit");
  const refs = useQuery({
    queryKey: ["references", search, status, page],
    queryFn: () => reviewApi.references({ search: search || undefined, status, page }),
  });
  const verify = useMutation({
    mutationFn: (id: string) => reviewApi.updateReference(id, { markVerified: true }),
    onSuccess: () => {
      toast.success("Marked as verified today");
      void qc.invalidateQueries({ queryKey: ["references"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div>
      <PageHeader
        title="Clinical references"
        description="Guidelines and sources clinicians can cite when approving cases. Add only real, published sources — never AI-generated ones."
        actions={
          canEdit && (
            <Button onClick={() => setEditing("new")}>
              <Plus /> Add reference
            </Button>
          )
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          className="max-w-xs"
          placeholder="Search title or organisation"
          aria-label="Search references"
          value={search}
          onChange={(e) => (setSearch(e.target.value), setPage(1))}
        />
        <Select value={status} onValueChange={(v) => (setStatus(v), setPage(1))}>
          <SelectTrigger className="w-40" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="retired">Retired</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <QueryState
        query={refs}
        isEmpty={(d) => d.items.length === 0}
        empty={<EmptyState title="No references found" />}
      >
        {(d) => (
          <>
            <ul className="space-y-2">
              {d.items.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-foreground/15 bg-card p-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <ReferenceLine r={r} />
                    <div className="text-xs text-muted-foreground">
                      {titleCase(r.type)}
                      {r.topics.length ? ` · ${r.topics.join(", ")}` : ""}
                      {r.countryCodes.length ? ` · ${r.countryCodes.join(", ")}` : ""}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        loading={verify.isPending && verify.variables === r.id}
                        onClick={() => verify.mutate(r.id)}
                      >
                        Verify today
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>
                        Edit
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <Pagination page={page} pageSize={d.pageSize} total={d.total} onPage={setPage} />
          </>
        )}
      </QueryState>
      {editing && (
        <ReferenceDialog
          reference={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function ReferenceDialog({
  reference,
  onClose,
}: {
  reference: FullReference | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    title: reference?.title ?? "",
    organization: reference?.organization ?? "",
    authors: reference?.authors ?? "",
    year: reference?.year ? String(reference.year) : "",
    type: reference?.type ?? "guideline",
    url: reference?.url ?? "",
    doi: reference?.doi ?? "",
    topics: reference?.topics.join(", ") ?? "",
    status: reference?.status ?? "active",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: () => {
      const body = {
        title: f.title.trim(),
        organization: f.organization.trim() || null,
        authors: f.authors.trim() || null,
        year: f.year ? Number(f.year) : null,
        type: f.type,
        url: f.url.trim() || null,
        doi: f.doi.trim() || null,
        topics: f.topics
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        ...(reference ? { status: f.status } : {}),
      };
      return reference
        ? reviewApi.updateReference(reference.id, body)
        : reviewApi.createReference(body);
    },
    onSuccess: () => {
      toast.success("Reference saved");
      void qc.invalidateQueries({ queryKey: ["references"] });
      onClose();
    },
    onError: (e) => {
      if (e instanceof ApiError && e.details)
        setErrors(Object.fromEntries(e.details.map((d) => [d.path, d.message])));
      else toast.error(errorMessage(e));
    },
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: e.target.value });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{reference ? "Edit reference" : "Add reference"}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Field id="ref-title" label="Title" error={errors.title} className="sm:col-span-2">
            <Input id="ref-title" value={f.title} onChange={set("title")} required />
          </Field>
          <Field id="ref-org" label="Organisation" optional error={errors.organization}>
            <Input id="ref-org" value={f.organization} onChange={set("organization")} />
          </Field>
          <Field id="ref-year" label="Year" optional error={errors.year}>
            <Input
              id="ref-year"
              type="number"
              min={1950}
              max={2100}
              value={f.year}
              onChange={set("year")}
            />
          </Field>
          <Field id="ref-authors" label="Authors" optional error={errors.authors}>
            <Input id="ref-authors" value={f.authors} onChange={set("authors")} />
          </Field>
          <Field id="ref-type" label="Type">
            <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v as typeof f.type })}>
              <SelectTrigger id="ref-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REFERENCE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {titleCase(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="ref-url" label="Link (https)" optional error={errors.url}>
            <Input
              id="ref-url"
              type="url"
              value={f.url}
              onChange={set("url")}
              placeholder="https://"
            />
          </Field>
          <Field id="ref-doi" label="DOI" optional error={errors.doi}>
            <Input id="ref-doi" value={f.doi} onChange={set("doi")} placeholder="10.1000/xyz" />
          </Field>
          <Field
            id="ref-topics"
            label="Topics"
            optional
            hint="Comma-separated"
            className="sm:col-span-2"
          >
            <Input id="ref-topics" value={f.topics} onChange={set("topics")} />
          </Field>
          {reference && (
            <Field id="ref-status" label="Status">
              <Select
                value={f.status}
                onValueChange={(v) => setF({ ...f, status: v as typeof f.status })}
              >
                <SelectTrigger id="ref-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={save.isPending} disabled={f.title.trim().length < 3}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---- Review history ----------------------------------------------------------------------------

export function ReviewHistoryPage() {
  const [status, setStatus] = useState<"published" | "changes_requested">("published");
  const [page, setPage] = useState(1);
  const queue = useQuery({
    queryKey: ["review-queue", "history", status, page],
    queryFn: () => reviewApi.queue({ status, page }),
  });
  return (
    <div>
      <PageHeader
        title="Review history"
        description="Decided versions. Open a case to see every version and every signed review."
      />
      <Tabs value={status} onValueChange={(v) => (setStatus(v as typeof status), setPage(1))}>
        <TabsList>
          <TabsTrigger value="published">Approved & published</TabsTrigger>
          <TabsTrigger value="changes_requested">Changes requested</TabsTrigger>
        </TabsList>
        <TabsContent value={status}>
          <QueryState
            query={queue}
            isEmpty={(d) => d.items.length === 0}
            empty={<EmptyState title="Nothing here yet" />}
          >
            {(d) => (
              <>
                <ul className="space-y-2">
                  {d.items.map((v) => (
                    <li key={v.versionId}>
                      <Link
                        to={`/review/missions/${v.missionKey}`}
                        className="flex items-center justify-between gap-2 rounded-xl border-2 border-foreground/15 bg-card p-3 hover:border-foreground"
                      >
                        <span>
                          <span className="font-bold">{v.title}</span>{" "}
                          <span className="text-sm text-muted-foreground">v{v.versionNumber}</span>
                        </span>
                        <VersionStatus status={v.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
                <Pagination page={page} pageSize={d.pageSize} total={d.total} onPage={setPage} />
              </>
            )}
          </QueryState>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function MissionHistoryPage() {
  const { key = "" } = useParams();
  const history = useQuery({
    queryKey: ["mission-history", key],
    queryFn: () => reviewApi.history(key),
  });
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        back={{ to: "/review/history", label: "Review history" }}
        title={`History: ${key}`}
      />
      <QueryState query={history}>
        {(h) => (
          <div className="space-y-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead>Change summary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {h.versions.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>
                      <Link
                        to={`/review/versions/${v.id}`}
                        className="font-bold text-primary underline"
                      >
                        v{v.versionNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <VersionStatus status={v.status} />
                    </TableCell>
                    <TableCell>{formatDate(v.submittedAt)}</TableCell>
                    <TableCell>{formatDate(v.publishedAt)}</TableCell>
                    <TableCell className="max-w-xs text-sm">{v.changeSummary ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <h2 className="text-xl font-extrabold">Signed reviews</h2>
            <ReviewsList reviews={h.reviews} />
          </div>
        )}
      </QueryState>
    </div>
  );
}

// ---- Reported AI debriefs ----------------------------------------------------------------------

export function AiFlagsPage() {
  const flags = useQuery({ queryKey: ["ai-flags"], queryFn: reviewApi.aiFlags });
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Reported debriefs"
        description="AI debriefs players reported as inaccurate, unsafe or unhelpful. Use them to improve case feedback and the debrief prompt."
      />
      <QueryState
        query={flags}
        isEmpty={(d) => d.items.length === 0}
        empty={<EmptyState icon="✅" title="No reports" />}
      >
        {(d) => (
          <ul className="space-y-4">
            {d.items.map((f, i) => (
              <li key={`${f.debriefId}-${i}`}>
                <Card flat>
                  <CardHeader>
                    <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                      <Badge variant="destructive">{titleCase(f.reason)}</Badge> {f.missionKey} ·{" "}
                      {learnerLevelLabel(f.level)}
                    </CardTitle>
                    <CardDescription>
                      Reported {formatDateTime(f.flaggedAt)}
                      {f.comment ? ` — "${f.comment}"` : ""}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p>
                      <span className="font-bold">Overall: </span>
                      {f.debrief.overall}
                    </p>
                    <details>
                      <summary className="cursor-pointer font-bold">Full debrief</summary>
                      <ol className="mt-2 list-decimal space-y-1 pl-5">
                        {f.debrief.decisions.map((x) => (
                          <li key={x.stepId}>
                            <span className="font-semibold">
                              {x.prompt} ({x.correct ? "correct" : "incorrect"}):
                            </span>{" "}
                            {x.explanation}
                          </li>
                        ))}
                      </ol>
                      <ul className="mt-2 list-disc pl-5">
                        {f.debrief.teachingPoints.map((t) => (
                          <li key={t}>{t}</li>
                        ))}
                      </ul>
                    </details>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </QueryState>
    </div>
  );
}

// ---- Reviewer profile (clinician application) --------------------------------------------------

export function ReviewerProfilePage() {
  return (
    <RequireRegistered>
      <ReviewerProfileInner />
    </RequireRegistered>
  );
}

function ReviewerProfileInner() {
  const qc = useQueryClient();
  const profile = useQuery({
    queryKey: ["clinician-profile"],
    queryFn: clinicianApi.profile,
    retry: false,
  });
  const countries = useCountries();
  const notFound = profile.error instanceof ApiError && profile.error.status === 404;
  const [f, setF] = useState<null | {
    fullName: string;
    credentials: string;
    profession: string;
    registrationBody: string;
    registrationNumber: string;
    countryCode: string;
    evidence: { id: string; name: string }[];
  }>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const editing = f ?? {
    fullName: profile.data?.fullName ?? "",
    credentials: profile.data?.credentials ?? "",
    profession: profile.data?.profession ?? "",
    registrationBody: profile.data?.registrationBody ?? "",
    registrationNumber: "",
    countryCode: profile.data?.countryCode ?? "",
    evidence: profile.data?.evidence.map((e) => ({ id: e.id, name: e.contentType })) ?? [],
  };
  const set = (patch: Partial<typeof editing>) => setF({ ...editing, ...patch });
  const upload = useMutation({
    mutationFn: clinicianApi.uploadEvidence,
    onSuccess: (a, file) => set({ evidence: [...editing.evidence, { id: a.id, name: file.name }] }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const submit = useMutation({
    mutationFn: () =>
      clinicianApi.submit({
        fullName: editing.fullName.trim(),
        credentials: editing.credentials.trim(),
        profession: editing.profession as never,
        registrationBody: editing.registrationBody.trim(),
        registrationNumber: editing.registrationNumber.trim(),
        countryCode: editing.countryCode,
        evidenceAssetIds: editing.evidence.map((e) => e.id),
      }),
    onSuccess: (p) => {
      qc.setQueryData(["clinician-profile"], p);
      setF(null);
      toast.success("Application submitted for verification");
    },
    onError: (e) => {
      if (e instanceof ApiError && e.details)
        setErrors(Object.fromEntries(e.details.map((d) => [d.path, d.message])));
      else toast.error(errorMessage(e));
    },
  });
  const p = profile.data;
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader
        back={{ to: "/play/settings", label: "Account settings" }}
        title="Reviewer profile"
        description="Verified clinicians review and approve cases before players see them. An administrator checks your registration before you can approve."
      />
      {profile.isPending ? (
        <LoadingState />
      ) : profile.isError && !notFound ? (
        <QueryState query={profile}>{() => null}</QueryState>
      ) : (
        <div className="space-y-6">
          {p && (
            <Alert
              variant={
                p.status === "verified"
                  ? "success"
                  : p.status === "rejected"
                    ? "destructive"
                    : "warning"
              }
            >
              <AlertTitle>
                {p.status === "verified"
                  ? "Verified"
                  : p.status === "rejected"
                    ? "Not verified"
                    : "Awaiting verification"}
              </AlertTitle>
              <AlertDescription>
                {p.status === "verified"
                  ? `Verified on ${formatDate(p.verifiedAt)}. Registration ${p.registrationNumberMasked}.`
                  : p.status === "rejected"
                    ? `Reason: ${p.rejectionReason ?? "not given"}. You can update and resubmit.`
                    : `Submitted ${formatDate(p.submittedAt)}. Changing your details restarts verification.`}
              </AlertDescription>
            </Alert>
          )}
          <Card flat>
            <CardContent className="pt-5">
              <form
                className="grid gap-4 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  setErrors({});
                  submit.mutate();
                }}
              >
                <Field id="cl-name" label="Full name (as registered)" error={errors.fullName}>
                  <Input
                    id="cl-name"
                    value={editing.fullName}
                    onChange={(e) => set({ fullName: e.target.value })}
                  />
                </Field>
                <Field
                  id="cl-cred"
                  label="Credentials"
                  hint="e.g. MBChB, RN, RM"
                  error={errors.credentials}
                >
                  <Input
                    id="cl-cred"
                    value={editing.credentials}
                    onChange={(e) => set({ credentials: e.target.value })}
                  />
                </Field>
                <Field id="cl-prof" label="Profession" error={errors.profession}>
                  <Select value={editing.profession} onValueChange={(v) => set({ profession: v })}>
                    <SelectTrigger id="cl-prof">
                      <SelectValue placeholder="Choose" />
                    </SelectTrigger>
                    <SelectContent>
                      {CLINICIAN_PROFESSIONS.map((x) => (
                        <SelectItem key={x} value={x}>
                          {titleCase(x)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field id="cl-country" label="Country of registration" error={errors.countryCode}>
                  <Select
                    value={editing.countryCode}
                    onValueChange={(v) => set({ countryCode: v })}
                  >
                    <SelectTrigger id="cl-country">
                      <SelectValue placeholder="Choose" />
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
                <Field
                  id="cl-body"
                  label="Registration body"
                  hint="e.g. Nursing and Midwifery Council of Nigeria"
                  error={errors.registrationBody}
                >
                  <Input
                    id="cl-body"
                    value={editing.registrationBody}
                    onChange={(e) => set({ registrationBody: e.target.value })}
                  />
                </Field>
                <Field
                  id="cl-number"
                  label="Registration number"
                  hint={
                    p
                      ? `Stored encrypted (${p.registrationNumberMasked}). Re-enter to submit changes.`
                      : "Stored encrypted; only verifiers can see it."
                  }
                  error={errors.registrationNumber}
                >
                  <Input
                    id="cl-number"
                    value={editing.registrationNumber}
                    autoComplete="off"
                    onChange={(e) => set({ registrationNumber: e.target.value })}
                  />
                </Field>
                <div className="space-y-2 sm:col-span-2">
                  <div className="text-sm font-bold">
                    Evidence (licence or certificate — PDF, PNG or JPEG, up to 5)
                  </div>
                  <ul className="space-y-1 text-sm">
                    {editing.evidence.map((e) => (
                      <li
                        key={e.id}
                        className="flex items-center justify-between rounded-lg bg-muted px-3 py-2"
                      >
                        <span>{e.name}</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            set({ evidence: editing.evidence.filter((x) => x.id !== e.id) })
                          }
                        >
                          Remove
                        </Button>
                      </li>
                    ))}
                  </ul>
                  {editing.evidence.length < 5 && (
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-foreground/40 px-4 py-3 text-sm font-bold hover:bg-muted">
                      <FileUp className="size-4" />{" "}
                      {upload.isPending ? "Uploading…" : "Upload evidence"}
                      <input
                        type="file"
                        accept="application/pdf,image/png,image/jpeg"
                        className="sr-only"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) upload.mutate(file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <Button
                    type="submit"
                    loading={submit.isPending}
                    disabled={
                      !editing.registrationNumber.trim() ||
                      !editing.profession ||
                      !editing.countryCode
                    }
                  >
                    {p ? "Update and resubmit" : "Submit application"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
