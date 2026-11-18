import { AU_REGIONS, COUNTRY_STATUSES } from "@ahq/api-contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ImageUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Field } from "@/components/common/form";
import { PageHeader, Pagination, StatCard } from "@/components/common/page";
import { EmptyState, QueryState } from "@/components/common/states";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { CountryFlag, REGION_LABELS } from "@/features/public/components";
import { VersionStatus } from "@/features/review/pages";
import { adminApi } from "@/lib/api/admin";
import { mediaUrl } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { reviewApi } from "@/lib/api/review";
import type { AdminCountry, FullVersion } from "@/lib/api/types";
import { useCan } from "@/lib/auth/permissions";
import { formatDate, formatDateTime, relativeTime, titleCase } from "@/lib/format";
import { useApiMutation } from "@/lib/step-up";

const splitList = (s: string) =>
  s
    .split(/[\n,]/)
    .map((x) => x.trim())
    .filter(Boolean);
const errorsOf = (e: unknown) =>
  e instanceof ApiError && e.details
    ? Object.fromEntries(e.details.map((d) => [d.path, d.message]))
    : {};

// ---- Countries ---------------------------------------------------------------------------------

export function AdminCountriesPage() {
  const [status, setStatus] = useState("all");
  const [region, setRegion] = useState("all");
  const [search, setSearch] = useState("");
  const q = {
    status: status === "all" ? undefined : status,
    region: region === "all" ? undefined : region,
    search: search.trim() || undefined,
  };
  const countries = useQuery({
    queryKey: ["admin-countries", q],
    queryFn: () => adminApi.countries(q),
  });
  return (
    <div>
      <PageHeader
        title="Countries"
        description="All 54 African Union member states. Activate a country when its content is ready."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          className="max-w-xs"
          placeholder="Search"
          aria-label="Search countries"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {COUNTRY_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {titleCase(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={region} onValueChange={setRegion}>
          <SelectTrigger className="w-44" aria-label="Region">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All regions</SelectItem>
            {AU_REGIONS.map((r) => (
              <SelectItem key={r} value={r}>
                {REGION_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <QueryState
        query={countries}
        isEmpty={(d) => d.items.length === 0}
        empty={<EmptyState title="No countries match" />}
      >
        {(d) => (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Country</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Unlock</TableHead>
                <TableHead>Cases</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.items.map((c) => (
                <TableRow key={c.code}>
                  <TableCell>
                    <span className="flex items-center gap-2 font-bold">
                      <CountryFlag country={c} className="text-xl" /> {c.name}{" "}
                      <span className="text-xs text-muted-foreground">{c.code}</span>
                    </span>
                  </TableCell>
                  <TableCell>{REGION_LABELS[c.region]}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        c.status === "active"
                          ? "success"
                          : c.status === "coming_soon"
                            ? "accent"
                            : "muted"
                      }
                    >
                      {titleCase(c.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {c.unlock.minHp} HP · level {c.unlock.minTierIndex + 1}
                  </TableCell>
                  <TableCell>{c.missionCount}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/admin/countries/${c.code}`}>Edit</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </QueryState>
    </div>
  );
}

export function AdminCountryPage() {
  const { code = "" } = useParams();
  const country = useQuery({
    queryKey: ["admin-country", code],
    queryFn: () => adminApi.country(code),
  });
  return (
    <div className="mx-auto max-w-4xl">
      <QueryState query={country}>
        {(c) => <CountryEditor key={c.updatedAt} country={c} />}
      </QueryState>
    </div>
  );
}

function ImageField({
  label,
  purpose,
  url,
  onUploaded,
  onClear,
}: {
  label: string;
  purpose: "country_flag" | "country_image";
  url: string | null;
  onUploaded: (id: string, url: string | null) => void;
  onClear: () => void;
}) {
  const upload = useApiMutation({
    mutationFn: (f: File) => adminApi.upload(f, purpose),
    onSuccess: (a) => onUploaded(a.id, a.url),
  });
  return (
    <div className="space-y-2">
      <div className="text-sm font-bold">{label}</div>
      {url ? (
        <img
          src={mediaUrl(url)!}
          alt=""
          className="h-24 rounded-lg border-2 border-foreground/20 object-cover"
        />
      ) : (
        <div className="flex h-24 w-36 items-center justify-center rounded-lg border-2 border-dashed border-foreground/30 text-xs text-muted-foreground">
          None
        </div>
      )}
      <div className="flex gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border-2 border-foreground bg-card px-3 py-1.5 text-xs font-bold">
          <ImageUp className="size-3.5" /> {upload.isPending ? "Uploading…" : "Upload"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload.mutate(f);
              e.target.value = "";
            }}
          />
        </label>
        {url && (
          <Button type="button" size="sm" variant="ghost" onClick={onClear}>
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}

function CountryEditor({ country }: { country: AdminCountry }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    name: country.name,
    region: country.region as string,
    status: country.status as string,
    focus: country.focus,
    description: country.description,
    healthPriorities: country.healthPriorities.join("\n"),
    languages: country.languages.join(", "),
    currencyLabel: country.currencyLabel ?? "",
    minHp: String(country.unlock.minHp),
    minTierIndex: String(country.unlock.minTierIndex),
    sortOrder: String(country.sortOrder),
    flagAssetId: country.flagAssetId,
    flagUrl: country.flagUrl,
    imageAssetId: country.imageAssetId,
    imageUrl: country.imageUrl,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useApiMutation({
    mutationFn: () =>
      adminApi.updateCountry(country.code, {
        name: f.name.trim(),
        region: f.region,
        status: f.status,
        focus: f.focus.trim(),
        description: f.description.trim(),
        healthPriorities: splitList(f.healthPriorities),
        languages: splitList(f.languages),
        currencyLabel: f.currencyLabel.trim() || null,
        unlock: { minHp: Number(f.minHp), minTierIndex: Number(f.minTierIndex) },
        sortOrder: Number(f.sortOrder),
        flagAssetId: f.flagAssetId,
        imageAssetId: f.imageAssetId,
      }),
    onSuccess: () => {
      setErrors({});
      void qc.invalidateQueries({ queryKey: ["admin-country", country.code] });
      void qc.invalidateQueries({ queryKey: ["admin-countries"] });
      void qc.invalidateQueries({ queryKey: ["countries"] });
    },
    onError: (e) => {
      setErrors(errorsOf(e));
      toast.error(errorMessage(e));
    },
    successMessage: "Country saved",
  });
  const set =
    (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setF({ ...f, [k]: e.target.value });
  return (
    <>
      <PageHeader
        back={{ to: "/admin/countries", label: "Countries" }}
        title={
          <span className="flex items-center gap-3">
            <CountryFlag country={country} /> {country.name}
          </span>
        }
        description={`Last updated ${formatDateTime(country.updatedAt)}`}
      />
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(undefined);
        }}
      >
        <Card flat>
          <CardHeader>
            <CardTitle className="text-base">Content</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field id="c-name" label="Name" error={errors.name}>
              <Input id="c-name" value={f.name} onChange={set("name")} />
            </Field>
            <Field id="c-region" label="Region">
              <Select value={f.region} onValueChange={(v) => setF({ ...f, region: v })}>
                <SelectTrigger id="c-region">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AU_REGIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {REGION_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field
              id="c-focus"
              label="Focus (one line)"
              error={errors.focus}
              className="sm:col-span-2"
            >
              <Input id="c-focus" value={f.focus} maxLength={160} onChange={set("focus")} />
            </Field>
            <Field
              id="c-desc"
              label="Description"
              error={errors.description}
              className="sm:col-span-2"
            >
              <Textarea
                id="c-desc"
                rows={5}
                value={f.description}
                maxLength={2000}
                onChange={set("description")}
              />
            </Field>
            <Field
              id="c-prio"
              label="Health priorities"
              hint="One per line (up to 10)"
              error={errors.healthPriorities}
            >
              <Textarea
                id="c-prio"
                rows={4}
                value={f.healthPriorities}
                onChange={set("healthPriorities")}
              />
            </Field>
            <div className="space-y-4">
              <Field id="c-lang" label="Languages" hint="Comma-separated">
                <Input id="c-lang" value={f.languages} onChange={set("languages")} />
              </Field>
              <Field id="c-cur" label="Currency label" optional>
                <Input id="c-cur" value={f.currencyLabel} onChange={set("currencyLabel")} />
              </Field>
            </div>
            <ImageField
              label="Flag image (optional — the emoji flag is used otherwise)"
              purpose="country_flag"
              url={f.flagUrl}
              onUploaded={(id, url) => setF({ ...f, flagAssetId: id, flagUrl: url })}
              onClear={() => setF({ ...f, flagAssetId: null, flagUrl: null })}
            />
            <ImageField
              label="Country image"
              purpose="country_image"
              url={f.imageUrl}
              onUploaded={(id, url) => setF({ ...f, imageAssetId: id, imageUrl: url })}
              onClear={() => setF({ ...f, imageAssetId: null, imageUrl: null })}
            />
          </CardContent>
        </Card>
        <Card flat>
          <CardHeader>
            <CardTitle className="text-base">Availability and unlock requirements</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-4">
            <Field id="c-status" label="Status">
              <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
                <SelectTrigger id="c-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRY_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {titleCase(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="c-hp" label="Minimum HP" error={errors["unlock.minHp"]}>
              <Input id="c-hp" type="number" min={0} value={f.minHp} onChange={set("minHp")} />
            </Field>
            <Field
              id="c-tier"
              label="Minimum level"
              hint="0 = first level"
              error={errors["unlock.minTierIndex"]}
            >
              <Input
                id="c-tier"
                type="number"
                min={0}
                max={19}
                value={f.minTierIndex}
                onChange={set("minTierIndex")}
              />
            </Field>
            <Field id="c-sort" label="Sort order">
              <Input
                id="c-sort"
                type="number"
                min={0}
                value={f.sortOrder}
                onChange={set("sortOrder")}
              />
            </Field>
          </CardContent>
        </Card>
        <Button type="submit" loading={save.isPending}>
          Save country
        </Button>
      </form>
      <AssignMissions code={country.code} />
    </>
  );
}

function AssignMissions({ code }: { code: string }) {
  const qc = useQueryClient();
  const canEdit = useCan("content:edit");
  const missions = useQuery({
    queryKey: ["admin-missions", "all"],
    queryFn: () => adminApi.missions({ pageSize: 100 }),
  });
  const [chosen, setSelected] = useState<string[] | null>(null);
  // Until the admin changes it, the selection is the missions currently in this country.
  const selected =
    chosen ?? missions.data?.items.filter((m) => m.countryCode === code).map((m) => m.key) ?? [];
  const assign = useApiMutation({
    mutationFn: () => adminApi.assignMissions(code, selected),
    onSuccess: (r) => {
      toast.success(r.note);
      void qc.invalidateQueries({ queryKey: ["admin-missions"] });
    },
  });
  if (!canEdit) return null;
  return (
    <Card flat className="mt-6">
      <CardHeader>
        <CardTitle className="text-base">Assign missions to this country</CardTitle>
        <CardDescription>
          Moving a mission to another country changes its content, so a new draft is created and
          needs clinician approval.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <QueryState query={missions}>
          {(d) => (
            <>
              <ul className="grid gap-2 sm:grid-cols-2">
                {d.items
                  .filter((m) => m.status !== "retired")
                  .map((m) => (
                    <li key={m.key}>
                      <label className="flex items-center gap-2 rounded-lg border-2 border-foreground/15 p-2 text-sm">
                        <Checkbox
                          checked={selected.includes(m.key)}
                          onCheckedChange={(v) =>
                            setSelected(
                              v === true
                                ? [...selected, m.key]
                                : selected.filter((x) => x !== m.key),
                            )
                          }
                        />
                        <span aria-hidden="true">{m.icon}</span> {m.published?.title ?? m.key}
                        <span className="ml-auto text-xs text-muted-foreground">
                          {m.countryCode}
                        </span>
                      </label>
                    </li>
                  ))}
              </ul>
              <Button
                className="mt-4"
                variant="outline"
                disabled={!selected.length}
                loading={assign.isPending}
                onClick={() => assign.mutate(undefined)}
              >
                Save assignment
              </Button>
            </>
          )}
        </QueryState>
      </CardContent>
    </Card>
  );
}

// ---- Missions ----------------------------------------------------------------------------------

export function AdminMissionsPage() {
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const q = {
    status: status === "all" ? undefined : status,
    search: search.trim() || undefined,
    page,
    pageSize: 20,
  };
  const missions = useQuery({
    queryKey: ["admin-missions", q],
    queryFn: () => adminApi.missions(q),
  });
  const canEdit = useCan("content:edit");
  return (
    <div>
      <PageHeader
        title="Missions"
        description="Admins author cases; only verified clinicians can approve them for players."
        actions={
          canEdit && (
            <Button asChild>
              <Link to="/admin/missions/new">
                <Plus /> New mission
              </Link>
            </Button>
          )
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          className="max-w-xs"
          placeholder="Search"
          aria-label="Search missions"
          value={search}
          onChange={(e) => (setSearch(e.target.value), setPage(1))}
        />
        <Select value={status} onValueChange={(v) => (setStatus(v), setPage(1))}>
          <SelectTrigger className="w-40" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["all", "draft", "published", "withdrawn", "retired"].map((s) => (
              <SelectItem key={s} value={s}>
                {s === "all" ? "All statuses" : titleCase(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <QueryState
        query={missions}
        isEmpty={(d) => d.items.length === 0}
        empty={<EmptyState title="No missions" />}
      >
        {(d) => (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mission</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead>Open version</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.items.map((m) => (
                  <TableRow key={m.key}>
                    <TableCell>
                      <div className="font-bold">
                        <span aria-hidden="true">{m.icon}</span> {m.published?.title ?? m.key}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {m.key} · {m.countryCode} · level {m.tier + 1}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          m.status === "published"
                            ? "success"
                            : m.status === "draft"
                              ? "muted"
                              : "outline"
                        }
                      >
                        {titleCase(m.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {m.published
                        ? `v${m.published.versionNumber} · ${m.published.reviewerName}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {m.openVersion ? <VersionStatus status={m.openVersion.status} /> : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{relativeTime(m.updatedAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/admin/missions/${m.key}`}>Open</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={page} pageSize={d.pageSize} total={d.total} onPage={setPage} />
          </>
        )}
      </QueryState>
    </div>
  );
}

type ContentDraft = {
  title: string;
  story: string;
  countryCode: string;
  learningObjectives: string;
  steps: {
    stepId: string;
    prompt: string;
    choices: {
      choiceId: string;
      text: string;
      correct: boolean;
      feedback: string;
      critical: boolean;
    }[];
  }[];
};

const emptyStep = (n: number): ContentDraft["steps"][number] => ({
  stepId: `s${n}`,
  prompt: "",
  choices: [1, 2, 3].map((c) => ({
    choiceId: `s${n}c${c}`,
    text: "",
    correct: c === 1,
    feedback: "",
    critical: false,
  })),
});
const toDraft = (c?: FullVersion["content"]): ContentDraft => ({
  title: c?.title ?? "",
  story: c?.story ?? "",
  countryCode: c?.countryCode ?? "",
  learningObjectives: c?.learningObjectives.join("\n") ?? "",
  steps: c?.steps.map((s) => ({ ...s, choices: s.choices.map((x) => ({ ...x })) })) ?? [
    emptyStep(1),
  ],
});
const fromDraft = (d: ContentDraft) => ({
  title: d.title.trim(),
  story: d.story.trim(),
  countryCode: d.countryCode,
  learningObjectives: d.learningObjectives
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean),
  steps: d.steps.map((s) => ({
    ...s,
    prompt: s.prompt.trim(),
    choices: s.choices.map((c) => ({ ...c, text: c.text.trim(), feedback: c.feedback.trim() })),
  })),
});

/** Clinical content editor (draft versions only). Answer keys are visible here to authors and reviewers only. */
function ContentEditor({
  value,
  onChange,
  errors,
}: {
  value: ContentDraft;
  onChange: (d: ContentDraft) => void;
  errors: Record<string, string>;
}) {
  const countries = useQuery({
    queryKey: ["admin-countries", {}],
    queryFn: () => adminApi.countries(),
  });
  const setStep = (i: number, s: ContentDraft["steps"][number]) =>
    onChange({ ...value, steps: value.steps.map((x, j) => (j === i ? s : x)) });
  const renumber = (steps: ContentDraft["steps"]) =>
    steps.map((s, i) => ({
      ...s,
      stepId: `s${i + 1}`,
      choices: s.choices.map((c, k) => ({ ...c, choiceId: `s${i + 1}c${k + 1}` })),
    }));
  const err = (k: string) => errors[`content.${k}`] ?? errors[k];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="m-title" label="Title" error={err("title")}>
          <Input
            id="m-title"
            value={value.title}
            maxLength={80}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
          />
        </Field>
        <Field id="m-country" label="Country" error={err("countryCode")}>
          <Select
            value={value.countryCode}
            onValueChange={(v) => onChange({ ...value, countryCode: v })}
          >
            <SelectTrigger id="m-country">
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
        <Field id="m-story" label="Patient story" error={err("story")} className="sm:col-span-2">
          <Textarea
            id="m-story"
            rows={5}
            value={value.story}
            maxLength={2000}
            onChange={(e) => onChange({ ...value, story: e.target.value })}
          />
        </Field>
        <Field
          id="m-obj"
          label="Learning objectives"
          hint="One per line, up to 5"
          optional
          error={err("learningObjectives")}
          className="sm:col-span-2"
        >
          <Textarea
            id="m-obj"
            rows={3}
            value={value.learningObjectives}
            onChange={(e) => onChange({ ...value, learningObjectives: e.target.value })}
          />
        </Field>
      </div>
      {value.steps.map((s, i) => (
        <Card key={s.stepId} flat>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Step {i + 1}</CardTitle>
            {value.steps.length > 1 && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  onChange({ ...value, steps: renumber(value.steps.filter((_, j) => j !== i)) })
                }
              >
                <Trash2 /> Remove step
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <Field id={`p-${i}`} label="Question" error={err(`steps.${i}.prompt`)}>
              <Input
                id={`p-${i}`}
                value={s.prompt}
                maxLength={300}
                onChange={(e) => setStep(i, { ...s, prompt: e.target.value })}
              />
            </Field>
            {err(`steps.${i}.choices`) && (
              <p className="text-sm font-semibold text-destructive">{err(`steps.${i}.choices`)}</p>
            )}
            {s.choices.map((c, k) => (
              <div
                key={c.choiceId}
                className="space-y-2 rounded-xl border-2 border-foreground/15 p-3"
              >
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-bold">Choice {k + 1}</span>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name={`correct-${i}`}
                      checked={c.correct}
                      onChange={() =>
                        setStep(i, {
                          ...s,
                          choices: s.choices.map((x, j) => ({
                            ...x,
                            correct: j === k,
                            critical: j === k ? false : x.critical,
                          })),
                        })
                      }
                    />
                    Official answer
                  </label>
                  <label className="flex items-center gap-1.5">
                    <Checkbox
                      checked={c.critical}
                      disabled={c.correct}
                      onCheckedChange={(v) =>
                        setStep(i, {
                          ...s,
                          choices: s.choices.map((x, j) =>
                            j === k ? { ...x, critical: v === true } : x,
                          ),
                        })
                      }
                    />
                    Critical (dangerous) error
                  </label>
                  {s.choices.length > 2 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="ml-auto"
                      onClick={() =>
                        setStep(i, {
                          ...s,
                          choices: s.choices
                            .filter((_, j) => j !== k)
                            .map((x, j) => ({ ...x, choiceId: `${s.stepId}c${j + 1}` })),
                        })
                      }
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <Input
                  aria-label={`Step ${i + 1} choice ${k + 1} text`}
                  placeholder="Choice text"
                  value={c.text}
                  maxLength={200}
                  onChange={(e) =>
                    setStep(i, {
                      ...s,
                      choices: s.choices.map((x, j) =>
                        j === k ? { ...x, text: e.target.value } : x,
                      ),
                    })
                  }
                />
                <Textarea
                  aria-label={`Step ${i + 1} choice ${k + 1} feedback`}
                  rows={2}
                  placeholder="Feedback shown after this choice"
                  value={c.feedback}
                  maxLength={500}
                  onChange={(e) =>
                    setStep(i, {
                      ...s,
                      choices: s.choices.map((x, j) =>
                        j === k ? { ...x, feedback: e.target.value } : x,
                      ),
                    })
                  }
                />
              </div>
            ))}
            {s.choices.length < 6 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setStep(i, {
                    ...s,
                    choices: [
                      ...s.choices,
                      {
                        choiceId: `${s.stepId}c${s.choices.length + 1}`,
                        text: "",
                        correct: false,
                        feedback: "",
                        critical: false,
                      },
                    ],
                  })
                }
              >
                <Plus /> Add choice
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
      {value.steps.length < 10 && (
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onChange({ ...value, steps: [...value.steps, emptyStep(value.steps.length + 1)] })
          }
        >
          <Plus /> Add step
        </Button>
      )}
    </div>
  );
}

function ReferencePicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const refs = useQuery({
    queryKey: ["references", "all-active"],
    queryFn: () => reviewApi.references({ status: "active", pageSize: 100 }),
  });
  return (
    <QueryState
      query={refs}
      isEmpty={(d) => d.items.length === 0}
      empty={<p className="text-sm text-muted-foreground">No references in the library yet.</p>}
    >
      {(d) => (
        <ul className="max-h-60 space-y-1 overflow-y-auto">
          {d.items.map((r) => (
            <li key={r.id}>
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={value.includes(r.id)}
                  onCheckedChange={(v) =>
                    onChange(v === true ? [...value, r.id] : value.filter((x) => x !== r.id))
                  }
                />
                <span>
                  {r.title}
                  {r.organization ? ` — ${r.organization}` : ""}
                  {r.year ? ` (${r.year})` : ""}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </QueryState>
  );
}

export function NewMissionPage() {
  const navigate = useNavigate();
  const [key, setKey] = useState("");
  const [icon, setIcon] = useState("🩺");
  const [tier, setTier] = useState("0");
  const [topics, setTopics] = useState("");
  const [content, setContent] = useState<ContentDraft>(toDraft());
  const [refIds, setRefIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const create = useApiMutation({
    mutationFn: () =>
      adminApi.createMission({
        key: key.trim(),
        icon: icon.trim(),
        tier: Number(tier),
        topics: splitList(topics),
        content: fromDraft(content),
        referenceIds: refIds,
      }),
    onSuccess: (r) => navigate(`/admin/versions/${r.version.id}`),
    onError: (e) => {
      setErrors(errorsOf(e));
      toast.error(errorMessage(e));
    },
    successMessage: "Draft created",
  });
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        back={{ to: "/admin/missions", label: "Missions" }}
        title="New mission"
        description="Creates version 1 as a draft. Players see nothing until a clinician approves it."
      />
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(undefined);
        }}
      >
        <Card flat>
          <CardHeader>
            <CardTitle className="text-base">Placement</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-4">
            <Field id="n-key" label="Key" hint="lowercase-slug, permanent" error={errors.key}>
              <Input
                id="n-key"
                value={key}
                onChange={(e) => setKey(e.target.value.toLowerCase())}
              />
            </Field>
            <Field id="n-icon" label="Icon (emoji)" error={errors.icon}>
              <Input
                id="n-icon"
                value={icon}
                maxLength={16}
                onChange={(e) => setIcon(e.target.value)}
              />
            </Field>
            <Field id="n-tier" label="Level" hint="0 = first level" error={errors.tier}>
              <Input
                id="n-tier"
                type="number"
                min={0}
                max={19}
                value={tier}
                onChange={(e) => setTier(e.target.value)}
              />
            </Field>
            <Field id="n-topics" label="Topics" hint="Comma-separated">
              <Input id="n-topics" value={topics} onChange={(e) => setTopics(e.target.value)} />
            </Field>
          </CardContent>
        </Card>
        <ContentEditor value={content} onChange={setContent} errors={errors} />
        <Card flat>
          <CardHeader>
            <CardTitle className="text-base">References</CardTitle>
            <CardDescription>
              Optional at draft stage; the reviewer confirms the supporting references.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ReferencePicker value={refIds} onChange={setRefIds} />
          </CardContent>
        </Card>
        <Button type="submit" size="lg" loading={create.isPending} disabled={!key.trim()}>
          Create draft
        </Button>
      </form>
    </div>
  );
}

export function AdminMissionPage() {
  const { key = "" } = useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const data = useQuery({ queryKey: ["admin-mission", key], queryFn: () => adminApi.mission(key) });
  const canEdit = useCan("content:edit");
  const canPublish = useCan("content:publish-control");
  const [action, setAction] = useState<null | "withdraw" | "restore" | "retire">(null);
  const [rollbackTo, setRollbackTo] = useState<number | null>(null);
  const [placement, setPlacement] = useState<{
    tier: string;
    icon: string;
    sortOrder: string;
    topics: string;
    offlineEligible: boolean;
  } | null>(null);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin-mission", key] });
    void qc.invalidateQueries({ queryKey: ["admin-missions"] });
    void qc.invalidateQueries({ queryKey: ["missions"] });
  };
  const draft = useApiMutation({
    mutationFn: () => adminApi.newDraft(key),
    onSuccess: (v) => navigate(`/admin/versions/${v.id}`),
    successMessage: "Draft created",
  });
  const control = useApiMutation({
    mutationFn: (reason: string) => adminApi.publishControl(key, action!, reason),
    onSuccess: () => (setAction(null), refresh()),
    successMessage: "Done",
  });
  const rollback = useApiMutation({
    mutationFn: (reason: string) => adminApi.rollback(key, rollbackTo!, reason),
    onSuccess: () => (setRollbackTo(null), refresh()),
    successMessage: "Rolled back",
  });
  const savePlacement = useApiMutation({
    mutationFn: () =>
      adminApi.updatePlacement(key, {
        tier: Number(placement!.tier),
        icon: placement!.icon.trim(),
        sortOrder: Number(placement!.sortOrder),
        topics: splitList(placement!.topics),
        offlineEligible: placement!.offlineEligible,
      }),
    onSuccess: () => (setPlacement(null), refresh()),
    successMessage: "Placement saved",
  });
  return (
    <div className="mx-auto max-w-5xl">
      <QueryState query={data}>
        {({ mission: m, history }) => (
          <>
            <PageHeader
              back={{ to: "/admin/missions", label: "Missions" }}
              title={
                <span className="flex items-center gap-3">
                  <span aria-hidden="true">{m.icon}</span> {m.published?.title ?? m.key}
                </span>
              }
              description={`${m.key} · ${m.countryCode} · level ${m.tier + 1}`}
              actions={
                <Badge variant={m.status === "published" ? "success" : "muted"}>
                  {titleCase(m.status)}
                </Badge>
              }
            />
            {m.published && (
              <Alert variant="success" className="mb-4">
                <AlertDescription>
                  Live: version {m.published.versionNumber}, approved by {m.published.reviewerName}{" "}
                  on {formatDate(m.published.approvedAt)}.
                </AlertDescription>
              </Alert>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <Card flat>
                <CardHeader>
                  <CardTitle className="text-base">Clinical content</CardTitle>
                  <CardDescription>
                    Content changes always create a new version that needs clinician approval.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {m.openVersion ? (
                    <Button asChild>
                      <Link to={`/admin/versions/${m.openVersion.id}`}>
                        Open v{m.openVersion.versionNumber} ({titleCase(m.openVersion.status)})
                      </Link>
                    </Button>
                  ) : (
                    canEdit &&
                    m.status !== "retired" && (
                      <Button loading={draft.isPending} onClick={() => draft.mutate(undefined)}>
                        Start new draft
                      </Button>
                    )
                  )}
                </CardContent>
              </Card>
              {canPublish && (
                <Card flat>
                  <CardHeader>
                    <CardTitle className="text-base">Publishing controls</CardTitle>
                    <CardDescription>
                      Withdrawing hides the case immediately and ends in-progress attempts.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {m.status === "published" && (
                      <Button variant="outline" onClick={() => setAction("withdraw")}>
                        Withdraw
                      </Button>
                    )}
                    {m.status === "withdrawn" && (
                      <Button variant="outline" onClick={() => setAction("restore")}>
                        Restore
                      </Button>
                    )}
                    {m.status !== "retired" && (
                      <Button variant="destructive" onClick={() => setAction("retire")}>
                        Retire
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
            <Card flat className="mt-4">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base">Gameplay placement</CardTitle>
                {canEdit && !placement && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setPlacement({
                        tier: String(m.tier),
                        icon: m.icon,
                        sortOrder: String(m.sortOrder),
                        topics: m.topics.join(", "),
                        offlineEligible: m.offlineEligible,
                      })
                    }
                  >
                    Edit
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {placement ? (
                  <form
                    className="grid gap-3 sm:grid-cols-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      savePlacement.mutate(undefined);
                    }}
                  >
                    <Field id="pl-tier" label="Level (0-based)">
                      <Input
                        id="pl-tier"
                        type="number"
                        min={0}
                        max={19}
                        value={placement.tier}
                        onChange={(e) => setPlacement({ ...placement, tier: e.target.value })}
                      />
                    </Field>
                    <Field id="pl-icon" label="Icon">
                      <Input
                        id="pl-icon"
                        value={placement.icon}
                        onChange={(e) => setPlacement({ ...placement, icon: e.target.value })}
                      />
                    </Field>
                    <Field id="pl-sort" label="Sort order">
                      <Input
                        id="pl-sort"
                        type="number"
                        value={placement.sortOrder}
                        onChange={(e) => setPlacement({ ...placement, sortOrder: e.target.value })}
                      />
                    </Field>
                    <Field id="pl-topics" label="Topics">
                      <Input
                        id="pl-topics"
                        value={placement.topics}
                        onChange={(e) => setPlacement({ ...placement, topics: e.target.value })}
                      />
                    </Field>
                    <label className="flex items-start gap-2 text-sm sm:col-span-4">
                      <Checkbox
                        checked={placement.offlineEligible}
                        onCheckedChange={(v) =>
                          setPlacement({ ...placement, offlineEligible: v === true })
                        }
                        aria-label="Available offline"
                      />
                      <span>
                        <span className="font-bold">Available offline in the mobile app.</span>{" "}
                        Players download the story and choices (never the answers) and see feedback
                        when their device syncs.
                      </span>
                    </label>
                    <div className="flex gap-2 sm:col-span-4">
                      <Button type="submit" loading={savePlacement.isPending}>
                        Save
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setPlacement(null)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <p className="text-sm">
                    Level {m.tier + 1} · sort {m.sortOrder} · topics:{" "}
                    {m.topics.join(", ") || "none"} · offline:{" "}
                    {m.offlineEligible ? "available" : "not available"}
                  </p>
                )}
              </CardContent>
            </Card>
            <h2 className="mb-3 mt-8 text-xl font-extrabold">Version history</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.versions.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>
                      <Link
                        className="font-bold text-primary underline"
                        to={`/admin/versions/${v.id}`}
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
                    <TableCell className="text-right">
                      {canPublish && v.status === "superseded" && v.publishedAt && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setRollbackTo(v.versionNumber)}
                        >
                          Roll back to this
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ConfirmDialog
              open={action !== null}
              onOpenChange={(o) => !o && setAction(null)}
              title={
                action === "withdraw"
                  ? "Withdraw this mission?"
                  : action === "restore"
                    ? "Restore this mission?"
                    : "Retire this mission permanently?"
              }
              description={
                action === "retire"
                  ? "Retired missions can't be played again. History is kept."
                  : undefined
              }
              requireReason
              variant={action === "restore" ? "default" : "destructive"}
              confirmLabel={titleCase(action ?? "")}
              loading={control.isPending}
              onConfirm={(r) => control.mutate(r)}
            />
            <ConfirmDialog
              open={rollbackTo !== null}
              onOpenChange={(o) => !o && setRollbackTo(null)}
              title={`Re-publish version ${rollbackTo}?`}
              description="Only an earlier clinician-approved version can be restored."
              requireReason
              confirmLabel="Roll back"
              loading={rollback.isPending}
              onConfirm={(r) => rollback.mutate(r)}
            />
          </>
        )}
      </QueryState>
    </div>
  );
}

export function VersionEditorPage() {
  const { id = "" } = useParams();
  const version = useQuery({
    queryKey: ["admin-version", id],
    queryFn: () => adminApi.version(id),
  });
  return (
    <div className="mx-auto max-w-4xl">
      {<QueryState query={version}>{(v) => <VersionEditor key={v.updatedAt} v={v} />}</QueryState>}
    </div>
  );
}

function VersionEditor({ v }: { v: FullVersion }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const editable = v.status === "draft" || v.status === "changes_requested";
  const canEdit = useCan("content:edit");
  const diff = useQuery({ queryKey: ["admin-diff", v.id], queryFn: () => adminApi.diff(v.id) });
  const [content, setContent] = useState(toDraft(v.content));
  const [refIds, setRefIds] = useState(v.references.map((r) => r.id));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitOpen, setSubmitOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const save = useApiMutation({
    mutationFn: () =>
      adminApi.updateDraft(v.id, {
        content: fromDraft(content),
        referenceIds: refIds,
        expectedUpdatedAt: v.updatedAt,
      }),
    onSuccess: (nv) => {
      setErrors({});
      qc.setQueryData(["admin-version", v.id], nv);
      void qc.invalidateQueries({ queryKey: ["admin-diff", v.id] });
    },
    onError: (e) => {
      setErrors(errorsOf(e));
      toast.error(errorMessage(e));
    },
    successMessage: "Draft saved",
  });
  const submit = useApiMutation({
    mutationFn: (summary: string) => adminApi.submitDraft(v.id, summary),
    onSuccess: (nv) => {
      setSubmitOpen(false);
      qc.setQueryData(["admin-version", v.id], nv);
      void qc.invalidateQueries({ queryKey: ["admin-mission", v.missionKey] });
    },
    successMessage: "Sent to clinician review",
  });
  const discard = useApiMutation({
    mutationFn: () => adminApi.discardDraft(v.id),
    onSuccess: () => navigate(`/admin/missions/${v.missionKey}`),
    successMessage: "Draft discarded",
  });
  return (
    <>
      <PageHeader
        back={{ to: `/admin/missions/${v.missionKey}`, label: v.missionKey }}
        title={`${v.content.title || v.missionKey} — v${v.versionNumber}`}
        actions={<VersionStatus status={v.status} />}
        description={`Last saved ${formatDateTime(v.updatedAt)}`}
      />
      {!editable && (
        <Alert variant="info" className="mb-4">
          <AlertDescription>
            This version is {titleCase(v.status).toLowerCase()} and can't be edited. Start a new
            draft from the mission page to make changes.
          </AlertDescription>
        </Alert>
      )}
      {editable && canEdit ? (
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(undefined);
          }}
        >
          <ContentEditor value={content} onChange={setContent} errors={errors} />
          <Card flat>
            <CardHeader>
              <CardTitle className="text-base">References</CardTitle>
            </CardHeader>
            <CardContent>
              <ReferencePicker value={refIds} onChange={setRefIds} />
            </CardContent>
          </Card>
          <div className="sticky bottom-0 flex flex-wrap gap-2 border-t-2 border-foreground/10 bg-background/95 py-3">
            <Button type="submit" loading={save.isPending}>
              Save draft
            </Button>
            <Button type="button" variant="secondary" onClick={() => setSubmitOpen(true)}>
              Submit for review
            </Button>
            <Button type="button" variant="ghost" onClick={() => setDiscardOpen(true)}>
              Discard
            </Button>
          </div>
        </form>
      ) : (
        <Card flat>
          <CardContent className="space-y-3 pt-5">
            <p className="whitespace-pre-line">{v.content.story}</p>
            {v.content.steps.map((s, i) => (
              <div key={s.stepId} className="rounded-xl border-2 border-foreground/15 p-3">
                <div className="font-bold">
                  Step {i + 1}: {s.prompt}
                </div>
                <ul className="mt-1 space-y-1 text-sm">
                  {s.choices.map((c) => (
                    <li key={c.choiceId} className="flex items-start gap-2">
                      {c.correct ? (
                        <CheckCircle2 className="mt-0.5 size-4 text-success" />
                      ) : c.critical ? (
                        <AlertTriangle className="mt-0.5 size-4 text-destructive" />
                      ) : (
                        <span className="size-4" />
                      )}
                      <span>
                        {c.text} <span className="text-muted-foreground">— {c.feedback}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      <h2 className="mb-3 mt-8 text-xl font-extrabold">Changes from the published version</h2>
      <QueryState query={diff}>
        {(d) =>
          d.against == null ? (
            <p className="text-sm text-muted-foreground">Nothing published yet.</p>
          ) : d.changes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No content changes from v{d.against} (saved state).
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {d.changes.map((c) => (
                <li key={c.path} className="rounded-lg border-2 border-foreground/15 p-2">
                  <code className="font-bold">{c.path}</code>: {JSON.stringify(c.before)} →{" "}
                  {JSON.stringify(c.after)}
                </li>
              ))}
            </ul>
          )
        }
      </QueryState>
      <ConfirmDialog
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        title="Submit for clinician review?"
        description="Save first — the saved draft is frozen and hashed. Any change after this needs a new version."
        requireReason
        reasonLabel="Change summary for the reviewer"
        confirmLabel="Submit"
        loading={submit.isPending}
        onConfirm={(r) => submit.mutate(r)}
      />
      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Discard this draft?"
        variant="destructive"
        confirmLabel="Discard"
        loading={discard.isPending}
        onConfirm={() => discard.mutate(undefined)}
      />
    </>
  );
}

// ---- Content publishing (review pipeline + reviewer assignment) --------------------------------

/** Clinical approval at a glance: review queue health, re-reviews pending and the reviewer pool. */
function ApprovalMonitorPanel() {
  const q = useQuery({ queryKey: ["admin-approvals"], queryFn: adminApi.approvals });
  if (!q.data) return null;
  const d = q.data;
  return (
    <section aria-label="Approval monitoring" className="space-y-3" data-testid="approval-monitor">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Published cases"
          value={d.missions.published}
          hint={`${d.missions.withdrawn} withdrawn · ${d.missions.retired} retired`}
        />
        <StatCard
          label="Awaiting review"
          value={d.versions.inReview}
          hint={
            d.oldestInReview
              ? `Oldest: ${d.oldestInReview.missionKey} v${d.oldestInReview.versionNumber}, ${d.oldestInReview.days} days`
              : "Queue is empty"
          }
        />
        <StatCard
          label="Edits pending re-approval"
          value={d.reReviewPending}
          hint="Players keep the approved version until a clinician approves the edit"
        />
        <StatCard
          label="Active reviewers"
          value={d.reviewers.active}
          hint={`${d.reviewers.pending} applications pending · ${d.assignments.overdue} overdue assignments`}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        Last 30 days: {d.decisionsLast30Days.approved} approved,{" "}
        {d.decisionsLast30Days.changesRequested} changes requested.
      </p>
      {d.publishedWithoutReferences.length > 0 && (
        <Alert variant="warning">
          <AlertDescription>
            Published without a clinical reference ({d.publishedWithoutReferences.length}):{" "}
            {d.publishedWithoutReferences.join(", ")}. AI debriefs for these cases cite no sources.
          </AlertDescription>
        </Alert>
      )}
    </section>
  );
}

export function PublishingPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const queue = useQuery({
    queryKey: ["review-queue", "admin", page],
    queryFn: () => reviewApi.queue({ status: "in_review", page }),
  });
  const assignments = useQuery({ queryKey: ["admin-assignments"], queryFn: adminApi.assignments });
  const reviewers = useQuery({
    queryKey: ["admin-clinicians", "verified"],
    queryFn: () => adminApi.clinicians("verified"),
  });
  const [pick, setPick] = useState<Record<string, string>>({});
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin-approvals"] });
    void qc.invalidateQueries({ queryKey: ["admin-assignments"] });
    void qc.invalidateQueries({ queryKey: ["review-queue"] });
  };
  const assign = useApiMutation({
    mutationFn: (v: { versionId: string; reviewerId: string }) =>
      adminApi.assign(v.versionId, v.reviewerId),
    onSuccess: refresh,
    successMessage: "Reviewer assigned",
  });
  const cancel = useApiMutation({
    mutationFn: (id: string) => adminApi.cancelAssignment(id),
    onSuccess: refresh,
    successMessage: "Assignment cancelled",
  });
  const eligible = (reviewers.data?.items ?? []).filter((r) => r.roles.includes("reviewer"));
  return (
    <div className="space-y-6">
      <PageHeader
        title="Content publishing"
        description="Cases waiting for clinician approval. Assign a verified reviewer who didn't author the version."
      />
      <ApprovalMonitorPanel />
      {reviewers.data && eligible.length === 0 && (
        <Alert variant="warning">
          <AlertDescription>
            No verified clinician has the reviewer role yet. Verify an application under{" "}
            <Link to="/admin/clinicians" className="font-bold underline">
              Clinicians
            </Link>
            , then grant the role on the user's page.
          </AlertDescription>
        </Alert>
      )}
      <QueryState
        query={queue}
        isEmpty={(d) => d.items.length === 0}
        empty={<EmptyState icon="✅" title="Nothing awaiting review" />}
      >
        {(d) => (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Case</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Assign reviewer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.items.map((v) => (
                  <TableRow key={v.versionId}>
                    <TableCell>
                      <Link
                        to={`/admin/versions/${v.versionId}`}
                        className="font-bold hover:underline"
                      >
                        {v.title}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {v.missionKey} v{v.versionNumber}
                      </div>
                    </TableCell>
                    <TableCell>{v.submittedAt ? relativeTime(v.submittedAt) : "—"}</TableCell>
                    <TableCell className="text-sm">
                      {v.assignees.map((a) => a.name).join(", ") || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Select
                          value={pick[v.versionId] ?? ""}
                          onValueChange={(r) => setPick({ ...pick, [v.versionId]: r })}
                        >
                          <SelectTrigger className="w-48" aria-label={`Reviewer for ${v.title}`}>
                            <SelectValue placeholder="Choose reviewer" />
                          </SelectTrigger>
                          <SelectContent>
                            {eligible.map((r) => (
                              <SelectItem key={r.userId} value={r.userId}>
                                {r.fullName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          disabled={!pick[v.versionId]}
                          loading={assign.isPending && assign.variables?.versionId === v.versionId}
                          onClick={() =>
                            assign.mutate({
                              versionId: v.versionId,
                              reviewerId: pick[v.versionId]!,
                            })
                          }
                        >
                          Assign
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={page} pageSize={d.pageSize} total={d.total} onPage={setPage} />
          </>
        )}
      </QueryState>
      <h2 className="text-xl font-extrabold">Open assignments</h2>
      <QueryState
        query={assignments}
        isEmpty={(d) => d.items.filter((a) => a.status === "open").length === 0}
        empty={<EmptyState title="No open assignments" />}
      >
        {(d) => (
          <ul className="space-y-2">
            {d.items
              .filter((a) => a.status === "open")
              .map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-foreground/15 bg-card p-3 text-sm"
                >
                  <span>
                    <span className="font-bold">
                      {a.missionKey} v{a.versionNumber}
                    </span>{" "}
                    → {a.reviewerName} · {relativeTime(a.createdAt)}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={cancel.isPending && cancel.variables === a.id}
                    onClick={() => cancel.mutate(a.id)}
                  >
                    Cancel
                  </Button>
                </li>
              ))}
          </ul>
        )}
      </QueryState>
    </div>
  );
}
