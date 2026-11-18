import { ROLES } from "@ahq/shared-types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Search } from "lucide-react";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import { Link, useNavigate, useParams } from "react-router";
import { BarList, ColumnChart } from "@/components/common/charts";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Field } from "@/components/common/form";
import { PageHeader, Pagination, StatCard } from "@/components/common/page";
import { EmptyState, QueryState } from "@/components/common/states";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { adminApi } from "@/lib/api/admin";
import { apiBlobUrl } from "@/lib/api/client";
import { API_PREFIX } from "@ahq/shared-types";
import { useCan } from "@/lib/auth/permissions";
import { useSessionStore } from "@/lib/auth/session-store";
import {
  downloadCsv,
  formatDate,
  formatDateTime,
  formatFunding,
  formatNumber,
  formatPercent,
  formatUsd,
  learnerLevelLabel,
  relativeTime,
  titleCase,
} from "@/lib/format";
import { useApiMutation } from "@/lib/step-up";
import type { MissionAnalytics } from "@/lib/api/types";
import { useRange } from "./shared";

// ---- Admin overview ----------------------------------------------------------------------------

export function AdminOverviewPage() {
  const canAnalytics = useCan("analytics:read");
  const overview = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => adminApi.overview(),
    enabled: canAnalytics,
  });
  const pendingClinicians = useQuery({
    queryKey: ["admin-clinicians", "pending"],
    queryFn: () => adminApi.clinicians("pending"),
    enabled: useCan("clinicians:verify"),
  });
  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin overview"
        description="Last 30 days at a glance. Every administrative change is recorded in the audit log."
      />
      {canAnalytics ? (
        <QueryState query={overview}>
          {(o) => (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard
                  label="Active players (7 days)"
                  value={formatNumber(o.activePlayers.weekly)}
                  hint={`${o.activePlayers.daily} today`}
                />
                <StatCard
                  label="Registered users"
                  value={formatNumber(o.users.registered)}
                  hint={`${o.newRegistrations} new · ${o.users.guests} guests`}
                />
                <StatCard
                  label="Cases completed"
                  value={formatNumber(o.attemptsCompleted)}
                  hint={`of ${o.attemptsStarted} started`}
                />
                <StatCard label="Story pass rate" value={formatPercent(o.storyPassRate)} />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <Card flat>
                  <CardHeader>
                    <CardTitle className="text-base">Content pipeline</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <Row
                      label="Awaiting clinician review"
                      value={o.content.versionsAwaitingReview}
                      to="/admin/publishing"
                    />
                    <Row
                      label="Open review assignments"
                      value={o.content.openReviewAssignments}
                      to="/admin/publishing"
                    />
                    <Row
                      label="Clinicians awaiting verification"
                      value={o.content.pendingClinicianVerifications}
                      to="/admin/clinicians"
                    />
                    {Object.entries(o.content.missionsByStatus).map(([k, v]) => (
                      <Row
                        key={k}
                        label={`Missions ${titleCase(k).toLowerCase()}`}
                        value={v}
                        to="/admin/missions"
                      />
                    ))}
                  </CardContent>
                </Card>
                <Card flat>
                  <CardHeader>
                    <CardTitle className="text-base">Hospital Commander</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <Row label="Shifts run" value={o.shifts} />
                    <Row
                      label="Average needs covered"
                      value={formatPercent(o.averageNeedsMetPct)}
                    />
                  </CardContent>
                </Card>
                <Card flat>
                  <CardHeader>
                    <CardTitle className="text-base">Accounts</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <Row label="Guest conversions" value={o.guestConversions} />
                    <Row label="Suspended" value={o.users.suspended} to="/admin/users" />
                    {Object.entries(o.users.byRole).map(([k, v]) => (
                      <Row key={k} label={`Role: ${k}`} value={v} />
                    ))}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </QueryState>
      ) : (
        <Alert variant="info">
          <AlertDescription>Analytics are not part of your permissions.</AlertDescription>
        </Alert>
      )}
      {pendingClinicians.data && pendingClinicians.data.items.length > 0 && (
        <Alert variant="warning">
          <AlertDescription>
            {pendingClinicians.data.items.length} clinician application(s) need verification.{" "}
            <Link to="/admin/clinicians" className="font-bold underline">
              Review now
            </Link>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function Row({ label, value, to }: { label: string; value: React.ReactNode; to?: string }) {
  return (
    <div className="flex justify-between gap-2">
      {to ? (
        <Link to={to} className="hover:underline">
          {label}
        </Link>
      ) : (
        <span>{label}</span>
      )}
      <span className="font-bold tabular-nums">{value}</span>
    </div>
  );
}

// ---- User management ---------------------------------------------------------------------------

export function UsersPage() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [page, setPage] = useState(1);
  const q = {
    search: search.trim() || undefined,
    role: role === "all" ? undefined : role,
    page,
    pageSize: 20,
  };
  const users = useQuery({ queryKey: ["admin-users", q], queryFn: () => adminApi.users(q) });
  return (
    <div>
      <PageHeader title="Users" description="Registered accounts (guests are not listed)." />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search name or email"
            aria-label="Search users"
            value={search}
            onChange={(e) => (setSearch(e.target.value), setPage(1))}
          />
        </div>
        <Select value={role} onValueChange={(v) => (setRole(v), setPage(1))}>
          <SelectTrigger className="w-40" aria-label="Role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {titleCase(r)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <QueryState
        query={users}
        isEmpty={(d) => d.items.length === 0}
        empty={<EmptyState title="No users match" />}
      >
        {(d) => (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.items.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="font-bold">{u.displayName}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </TableCell>
                    <TableCell className="space-x-1">
                      {u.roles.map((r) => (
                        <Badge
                          key={r}
                          variant={
                            r === "admin" ? "default" : r === "reviewer" ? "secondary" : "muted"
                          }
                        >
                          {r}
                        </Badge>
                      ))}
                    </TableCell>
                    <TableCell>
                      {u.suspended ? (
                        <Badge variant="destructive">Suspended</Badge>
                      ) : u.emailVerified ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="outline">Unverified</Badge>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(u.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/admin/users/${u.id}`}>Manage</Link>
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

export function UserDetailPage() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const me = useSessionStore((s) => s.user);
  const user = useQuery({ queryKey: ["admin-user", id], queryFn: () => adminApi.user(id) });
  const player = useQuery({
    queryKey: ["admin-player", id],
    queryFn: () => adminApi.player(id),
    retry: false,
  });
  const audit = useQuery({
    queryKey: ["admin-audit", "target", id],
    queryFn: () => adminApi.auditLogs({ targetId: id, pageSize: 10 }),
    enabled: useCan("audit:read"),
  });
  const canRoles = useCan("users:manage-roles");
  const canManage = useCan("users:manage");
  const [dialog, setDialog] = useState<
    null | "roles" | "suspend" | "unsuspend" | "revoke" | "adjust" | "erase"
  >(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [adjust, setAdjust] = useState({ hp: "0", funding: "0", reason: "" });
  const [eraseEmail, setEraseEmail] = useState("");
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin-user", id] });
    void qc.invalidateQueries({ queryKey: ["admin-player", id] });
    void qc.invalidateQueries({ queryKey: ["admin-audit"] });
    void qc.invalidateQueries({ queryKey: ["admin-users"] });
    setDialog(null);
  };
  const setRolesM = useApiMutation({
    mutationFn: (reason: string) =>
      adminApi.setRoles(
        id,
        roles.filter((r) => r !== "player"),
        reason || undefined,
      ),
    onSuccess: refresh,
    successMessage: "Roles updated — the user was signed out everywhere",
  });
  const suspend = useApiMutation({
    mutationFn: (reason: string) => adminApi.suspend(id, reason),
    onSuccess: refresh,
    successMessage: "Account suspended",
  });
  const unsuspend = useApiMutation({
    mutationFn: (reason: string) => adminApi.unsuspend(id, reason),
    onSuccess: refresh,
    successMessage: "Suspension lifted",
  });
  const revoke = useApiMutation({
    mutationFn: () => adminApi.revokeSessions(id),
    onSuccess: refresh,
    successMessage: "Signed out of every device",
  });
  const adjustM = useApiMutation({
    mutationFn: () =>
      adminApi.adjust(id, {
        hp: Number(adjust.hp),
        funding: Number(adjust.funding),
        reason: adjust.reason.trim(),
      }),
    onSuccess: refresh,
    successMessage: "Adjustment applied",
  });
  const erase = useApiMutation({
    mutationFn: (reason: string) => adminApi.erase(id, { reason, confirmEmail: eraseEmail }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
      navigate("/admin/users");
    },
    successMessage: "Account and personal data erased",
  });
  return (
    <div className="mx-auto max-w-5xl">
      <QueryState query={user}>
        {(u) => {
          const self = me?.id === u.id;
          return (
            <>
              <PageHeader
                back={{ to: "/admin/users", label: "Users" }}
                title={u.displayName}
                description={u.email}
              />
              <div className="grid gap-4 md:grid-cols-3">
                <Card flat className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-base">Account</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <span className="font-bold">Roles: </span>
                      {u.roles.join(", ")}
                    </div>
                    <div>
                      <span className="font-bold">Email: </span>
                      {u.emailVerified ? "verified" : "not verified"}
                    </div>
                    <div>
                      <span className="font-bold">Two-factor: </span>
                      {u.mfaEnabled ? "on" : "off"}
                    </div>
                    <div>
                      <span className="font-bold">Status: </span>
                      {u.suspended ? "suspended" : "active"}
                    </div>
                    <div>
                      <span className="font-bold">Joined: </span>
                      {formatDate(u.createdAt)}
                    </div>
                  </CardContent>
                </Card>
                <Card flat>
                  <CardHeader>
                    <CardTitle className="text-base">Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    {canRoles && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={self}
                        onClick={() => (setRoles([...u.roles]), setDialog("roles"))}
                      >
                        Change roles
                      </Button>
                    )}
                    {canManage && (
                      <>
                        {u.suspended ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDialog("unsuspend")}
                          >
                            Lift suspension
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={self}
                            onClick={() => setDialog("suspend")}
                          >
                            Suspend
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => setDialog("revoke")}>
                          Sign out everywhere
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setDialog("adjust")}>
                          Adjust HP / funding
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={self}
                          onClick={() => setDialog("erase")}
                        >
                          Erase account
                        </Button>
                      </>
                    )}
                    {self && (
                      <p className="text-xs text-muted-foreground">
                        You can't change your own roles or suspend yourself.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
              <h2 className="mb-3 mt-8 text-xl font-extrabold">Player progress</h2>
              <QueryState query={player}>
                {(p) => (
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <StatCard
                      label="Health Points"
                      value={p.progress.hp}
                      hint={p.progress.tier.name}
                    />
                    <StatCard label="Funding" value={formatFunding(p.progress.funding)} />
                    <StatCard
                      label="Missions passed"
                      value={Object.values(p.progress.missions).filter((m) => m.passed).length}
                    />
                    <StatCard
                      label="Level"
                      value={learnerLevelLabel(p.profile.learnerLevel)}
                      hint={p.profile.institution ?? undefined}
                    />
                  </div>
                )}
              </QueryState>
              {audit.data && (
                <>
                  <h2 className="mb-3 mt-8 text-xl font-extrabold">Recent audit entries</h2>
                  {audit.data.items.length === 0 ? (
                    <EmptyState title="No administrative changes recorded" />
                  ) : (
                    <ul className="space-y-2 text-sm">
                      {audit.data.items.map((a) => (
                        <li
                          key={a.id}
                          className="rounded-xl border-2 border-foreground/15 bg-card p-3"
                        >
                          <span className="font-bold">{a.action}</span> ·{" "}
                          {formatDateTime(a.createdAt)}
                          {a.reason && (
                            <div className="text-muted-foreground">Reason: {a.reason}</div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
              <Dialog open={dialog === "roles"} onOpenChange={(o) => !o && setDialog(null)}>
                <DialogContent aria-describedby={undefined}>
                  <DialogHeader>
                    <DialogTitle>Change roles</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    {ROLES.map((r) => (
                      <label key={r} className="flex items-start gap-3 text-sm">
                        <Checkbox
                          checked={roles.includes(r)}
                          disabled={r === "player"}
                          onCheckedChange={(v) =>
                            setRoles((x) => (v === true ? [...x, r] : x.filter((y) => y !== r)))
                          }
                        />
                        <span>
                          <span className="font-bold">{titleCase(r)}</span>
                          {r === "player" && " — always kept"}
                          {r === "reviewer" && " — requires verified clinician credentials"}
                          {r === "admin" && " — requires two-factor authentication"}
                        </span>
                      </label>
                    ))}
                    <Alert variant="info">
                      <AlertDescription>
                        The user is signed out of every device so the new permissions apply
                        immediately.
                      </AlertDescription>
                    </Alert>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDialog(null)}>
                      Cancel
                    </Button>
                    <Button loading={setRolesM.isPending} onClick={() => setRolesM.mutate("")}>
                      Save roles
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <ConfirmDialog
                open={dialog === "suspend"}
                onOpenChange={(o) => !o && setDialog(null)}
                title="Suspend this account?"
                description="They are signed out everywhere and can't sign in until the suspension is lifted."
                requireReason
                variant="destructive"
                confirmLabel="Suspend"
                loading={suspend.isPending}
                onConfirm={(r) => suspend.mutate(r)}
              />
              <ConfirmDialog
                open={dialog === "unsuspend"}
                onOpenChange={(o) => !o && setDialog(null)}
                title="Lift the suspension?"
                requireReason
                confirmLabel="Lift suspension"
                loading={unsuspend.isPending}
                onConfirm={(r) => unsuspend.mutate(r)}
              />
              <ConfirmDialog
                open={dialog === "revoke"}
                onOpenChange={(o) => !o && setDialog(null)}
                title="Sign this user out of every device?"
                confirmLabel="Sign out everywhere"
                loading={revoke.isPending}
                onConfirm={() => revoke.mutate(undefined)}
              />
              <Dialog open={dialog === "adjust"} onOpenChange={(o) => !o && setDialog(null)}>
                <DialogContent aria-describedby={undefined}>
                  <DialogHeader>
                    <DialogTitle>Adjust HP / funding</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field id="adj-hp" label="HP change" hint="Negative to remove">
                      <Input
                        id="adj-hp"
                        type="number"
                        value={adjust.hp}
                        onChange={(e) => setAdjust({ ...adjust, hp: e.target.value })}
                      />
                    </Field>
                    <Field id="adj-funding" label="Funding change">
                      <Input
                        id="adj-funding"
                        type="number"
                        value={adjust.funding}
                        onChange={(e) => setAdjust({ ...adjust, funding: e.target.value })}
                      />
                    </Field>
                    <Field id="adj-reason" label="Reason (audited)" className="sm:col-span-2">
                      <Textarea
                        id="adj-reason"
                        value={adjust.reason}
                        onChange={(e) => setAdjust({ ...adjust, reason: e.target.value })}
                      />
                    </Field>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDialog(null)}>
                      Cancel
                    </Button>
                    <Button
                      loading={adjustM.isPending}
                      disabled={
                        adjust.reason.trim().length < 3 ||
                        (Number(adjust.hp) === 0 && Number(adjust.funding) === 0)
                      }
                      onClick={() => adjustM.mutate(undefined)}
                    >
                      Apply
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <ConfirmDialog
                open={dialog === "erase"}
                onOpenChange={(o) => !o && setDialog(null)}
                title="Erase this account permanently?"
                description="Deletes the account, progress, attempts, shifts, devices and uploaded evidence. This cannot be undone. The audit record is kept."
                requireReason
                variant="destructive"
                confirmLabel="Erase permanently"
                loading={erase.isPending}
                onConfirm={(r) => erase.mutate(r)}
              >
                <Field id="erase-email" label={`Type the account email (${u.email}) to confirm`}>
                  <Input
                    id="erase-email"
                    value={eraseEmail}
                    onChange={(e) => setEraseEmail(e.target.value)}
                    autoComplete="off"
                  />
                </Field>
              </ConfirmDialog>
            </>
          );
        }}
      </QueryState>
    </div>
  );
}

// ---- Clinician management ----------------------------------------------------------------------

export function CliniciansPage() {
  const [status, setStatus] = useState("pending");
  const list = useQuery({
    queryKey: ["admin-clinicians", status],
    queryFn: () => adminApi.clinicians(status),
  });
  return (
    <div>
      <PageHeader
        title="Clinicians"
        description="Verify registration details before a clinician can be given the reviewer role."
      />
      <Tabs value={status} onValueChange={setStatus}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="verified">Verified</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>
        <TabsContent value={status}>
          <QueryState
            query={list}
            isEmpty={(d) => d.items.length === 0}
            empty={<EmptyState title={`No ${status} applications`} />}
          >
            {(d) => (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Clinician</TableHead>
                    <TableHead>Profession</TableHead>
                    <TableHead>Registration</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.items.map((c) => (
                    <TableRow key={c.userId}>
                      <TableCell>
                        <div className="font-bold">
                          {c.fullName}{" "}
                          <span className="font-normal text-muted-foreground">
                            ({c.credentials})
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">{c.email}</div>
                      </TableCell>
                      <TableCell>{titleCase(c.profession)}</TableCell>
                      <TableCell className="text-sm">
                        {c.registrationBody} · {c.countryCode}
                      </TableCell>
                      <TableCell>{formatDate(c.submittedAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/admin/clinicians/${c.userId}`}>Open</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </QueryState>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function ClinicianDetailPage() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const me = useSessionStore((s) => s.user);
  const c = useQuery({ queryKey: ["admin-clinician", id], queryFn: () => adminApi.clinician(id) });
  const [decision, setDecision] = useState<null | "verified" | "rejected">(null);
  const decide = useApiMutation({
    mutationFn: (reason: string) => adminApi.verifyClinician(id, decision!, reason),
    onSuccess: () => {
      setDecision(null);
      void qc.invalidateQueries({ queryKey: ["admin-clinician", id] });
      void qc.invalidateQueries({ queryKey: ["admin-clinicians"] });
    },
    successMessage: (r) =>
      r.status === "verified" ? "Credentials verified" : "Application rejected",
  });
  const openEvidence = async (evidenceId: string) => {
    const url = await apiBlobUrl(`${API_PREFIX}/admin/media/${evidenceId}/content`);
    window.open(url, "_blank", "noopener");
  };
  return (
    <div className="mx-auto max-w-3xl">
      <QueryState query={c}>
        {(x) => (
          <>
            <PageHeader
              back={{ to: "/admin/clinicians", label: "Clinicians" }}
              title={x.fullName}
              description={x.email}
              actions={
                <Badge
                  variant={
                    x.status === "verified"
                      ? "success"
                      : x.status === "rejected"
                        ? "destructive"
                        : "accent"
                  }
                >
                  {titleCase(x.status)}
                </Badge>
              }
            />
            <Card flat>
              <CardContent className="grid gap-3 pt-5 text-sm sm:grid-cols-2">
                <div>
                  <span className="font-bold">Credentials: </span>
                  {x.credentials}
                </div>
                <div>
                  <span className="font-bold">Profession: </span>
                  {titleCase(x.profession)}
                </div>
                <div>
                  <span className="font-bold">Registration body: </span>
                  {x.registrationBody}
                </div>
                <div>
                  <span className="font-bold">Registration number: </span>
                  <code>{x.registrationNumber}</code>
                </div>
                <div>
                  <span className="font-bold">Country: </span>
                  {x.countryCode}
                </div>
                <div>
                  <span className="font-bold">Current roles: </span>
                  {x.roles.join(", ")}
                </div>
                {x.rejectionReason && (
                  <div className="sm:col-span-2">
                    <span className="font-bold">Rejection reason: </span>
                    {x.rejectionReason}
                  </div>
                )}
              </CardContent>
            </Card>
            <h2 className="mb-2 mt-6 font-extrabold">Evidence</h2>
            {x.evidence.length === 0 ? (
              <p className="text-sm text-muted-foreground">No files uploaded.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {x.evidence.map((e, i) => (
                  <Button
                    key={e.id}
                    variant="outline"
                    size="sm"
                    onClick={() => void openEvidence(e.id)}
                  >
                    <FileText /> File {i + 1} ({e.contentType})
                  </Button>
                ))}
              </div>
            )}
            <Alert variant="info" className="mt-6">
              <AlertDescription>
                Check the registration number with {x.registrationBody} before verifying. After
                verifying, grant the reviewer role from the user's page.
              </AlertDescription>
            </Alert>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                disabled={me?.id === x.userId || x.status === "verified"}
                onClick={() => setDecision("verified")}
              >
                Verify credentials
              </Button>
              <Button
                variant="destructive"
                disabled={me?.id === x.userId}
                onClick={() => setDecision("rejected")}
              >
                Reject
              </Button>
              <Button asChild variant="outline">
                <Link to={`/admin/users/${x.userId}`}>Open user</Link>
              </Button>
            </div>
            <ConfirmDialog
              open={decision !== null}
              onOpenChange={(o) => !o && setDecision(null)}
              title={
                decision === "verified" ? "Verify these credentials?" : "Reject this application?"
              }
              requireReason
              reasonLabel={
                decision === "verified" ? "How did you verify it?" : "Reason shown to the applicant"
              }
              variant={decision === "rejected" ? "destructive" : "secondary"}
              confirmLabel={decision === "verified" ? "Verify" : "Reject"}
              loading={decide.isPending}
              onConfirm={(r) => decide.mutate(r)}
            />
          </>
        )}
      </QueryState>
    </div>
  );
}

// ---- Analytics ---------------------------------------------------------------------------------

export function AnalyticsPage() {
  const { range, control } = useRange();
  const overview = useQuery({
    queryKey: ["admin-overview", range],
    queryFn: () => adminApi.overview(range),
  });
  const missions = useQuery({
    queryKey: ["admin-mission-analytics", range],
    queryFn: () => adminApi.missionAnalytics(range),
  });
  const funnel = useQuery({
    queryKey: ["admin-funnel", range],
    queryFn: () => adminApi.funnel(range),
  });
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Aggregates only — no personal data."
        actions={control}
      />
      <QueryState query={overview}>
        {(o) => (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Active players (30 days)"
              value={formatNumber(o.activePlayers.monthly)}
              hint={`${o.activePlayers.weekly} this week`}
            />
            <StatCard
              label="New registrations"
              value={formatNumber(o.newRegistrations)}
              hint={`${o.guestConversions} guest conversions`}
            />
            <StatCard label="Average score" value={formatPercent(o.averageScorePct)} />
            <StatCard
              label="Offline sync events"
              value={formatNumber(o.sync.eventsProcessed)}
              hint={`${o.sync.eventsRejected} rejected`}
            />
          </div>
        )}
      </QueryState>
      <div className="grid gap-4 lg:grid-cols-2">
        <QueryState query={missions}>
          {(m) => (
            <BarList
              title="Pass rate by mission"
              description="Completed story and practice attempts in the period. Hover for details."
              valueHeader="Pass rate"
              max={1}
              data={m.items.map((i) => ({
                label: `${i.missionKey} v${i.versionNumber}`,
                value: i.passRate ?? 0,
                display: formatPercent(i.passRate),
                note: `${i.completed}/${i.attempts} completed · average score ${formatPercent(i.avgScorePct)}`,
              }))}
            />
          )}
        </QueryState>
        <QueryState query={funnel}>
          {(f) => (
            <BarList
              title="Guest funnel"
              description={f.note}
              valueHeader="Accounts"
              data={f.steps.map((s) => ({
                label: titleCase(s.name),
                value: s.count,
                display: formatNumber(s.count),
              }))}
            />
          )}
        </QueryState>
      </div>
      <QueryState
        query={missions}
        isEmpty={(m) => m.items.length === 0}
        empty={<EmptyState title="No attempts in this period" />}
      >
        {(m) => {
          const item =
            m.items.find((i) => `${i.missionKey}-${i.versionNumber}` === selected) ?? m.items[0]!;
          return (
            <Card flat>
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Choice distribution</CardTitle>
                  <CardDescription>
                    How often each option was chosen — spot confusing steps for clinicians.
                  </CardDescription>
                </div>
                <Select
                  value={`${item.missionKey}-${item.versionNumber}`}
                  onValueChange={setSelected}
                >
                  <SelectTrigger className="w-56" aria-label="Mission">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {m.items.map((i) => (
                      <SelectItem
                        key={`${i.missionKey}-${i.versionNumber}`}
                        value={`${i.missionKey}-${i.versionNumber}`}
                      >
                        {i.missionKey} v{i.versionNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                <ChoiceDistribution item={item} />
              </CardContent>
            </Card>
          );
        }}
      </QueryState>
    </div>
  );
}

/** Per-step bars labelled with the choice text of that exact version; the official answer is marked. */
function ChoiceDistribution({ item }: { item: MissionAnalytics["items"][number] }) {
  const canRead = useCan("content:read");
  const mission = useQuery({
    queryKey: ["admin-mission", item.missionKey],
    queryFn: () => adminApi.mission(item.missionKey),
    enabled: canRead,
  });
  const versionId = mission.data?.history.versions.find(
    (v) => v.versionNumber === item.versionNumber,
  )?.id;
  const version = useQuery({
    queryKey: ["admin-version", versionId],
    queryFn: () => adminApi.version(versionId!),
    enabled: Boolean(versionId),
  });
  const steps = [...new Set(item.choiceDistribution.map((c) => c.stepId))];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {steps.map((s) => {
        const step = version.data?.content.steps.find((x) => x.stepId === s);
        const rows = item.choiceDistribution.filter((c) => c.stepId === s);
        const total = rows.reduce((a, c) => a + c.count, 0);
        return (
          <BarList
            key={s}
            title={step ? `Step ${s.slice(1)}: ${step.prompt}` : `Step ${s.slice(1)}`}
            valueHeader="Chosen"
            max={Math.max(1, total)}
            data={rows.map((c) => {
              const choice = step?.choices.find((x) => x.choiceId === c.choiceId);
              return {
                label: choice ? `${choice.correct ? "✓ " : ""}${choice.text}` : c.choiceId,
                value: c.count,
                display: `${c.count} (${formatPercent(c.count / Math.max(1, total))})`,
                note: choice
                  ? `${choice.correct ? "Official answer" : choice.critical ? "Flagged as a critical error" : "Incorrect option"} · ${choice.text}`
                  : undefined,
              };
            })}
          />
        );
      })}
    </div>
  );
}

// ---- Reports -----------------------------------------------------------------------------------

export function ReportsPage() {
  const { range, control, days } = useRange();
  const missions = useQuery({
    queryKey: ["admin-mission-analytics", range],
    queryFn: () => adminApi.missionAnalytics(range),
  });
  const overview = useQuery({
    queryKey: ["admin-overview", range],
    queryFn: () => adminApi.overview(range),
  });
  const ai = useQuery({
    queryKey: ["admin-ai-usage", range],
    queryFn: () => adminApi.aiUsage(range),
  });
  const audit = useQuery({
    queryKey: ["admin-audit", "report", range],
    queryFn: () => adminApi.auditLogs({ from: range.from, to: range.to, pageSize: 100 }),
    enabled: useCan("audit:read"),
  });
  const stamp = new Date().toISOString().slice(0, 10);
  const reports = [
    {
      title: "Mission performance",
      description: "Attempts, completion, pass rate and average score per mission version.",
      ready: missions.data,
      rows: () =>
        missions.data!.items.map((i) => ({
          mission: i.missionKey,
          version: i.versionNumber,
          country: i.countryCode,
          attempts: i.attempts,
          completed: i.completed,
          completion_rate: i.completionRate,
          pass_rate: i.passRate,
          average_score_pct: i.avgScorePct,
        })),
    },
    {
      title: "Platform summary",
      description: "Users, activity, gameplay, hospital and content pipeline totals.",
      ready: overview.data,
      rows: () => {
        const o = overview.data!;
        return [
          { metric: "active_players_daily", value: o.activePlayers.daily },
          { metric: "active_players_weekly", value: o.activePlayers.weekly },
          { metric: "active_players_monthly", value: o.activePlayers.monthly },
          { metric: "registered_users", value: o.users.registered },
          { metric: "new_registrations", value: o.newRegistrations },
          { metric: "guest_conversions", value: o.guestConversions },
          { metric: "attempts_started", value: o.attemptsStarted },
          { metric: "attempts_completed", value: o.attemptsCompleted },
          { metric: "story_pass_rate", value: o.storyPassRate },
          { metric: "shifts", value: o.shifts },
          { metric: "versions_awaiting_review", value: o.content.versionsAwaitingReview },
        ];
      },
    },
    {
      title: "AI usage and cost",
      description: "Requests, failures, tokens and cost per day.",
      ready: ai.data,
      rows: () => ai.data!.series.map((s) => ({ ...s })),
    },
    {
      title: "Audit log extract",
      description: "Most recent 100 administrative actions in the period.",
      ready: audit.data,
      rows: () =>
        audit.data!.items.map((a) => ({
          when: a.createdAt,
          action: a.action,
          actor: a.actorId,
          target_type: a.targetType,
          target: a.targetId,
          reason: a.reason,
        })),
    },
  ];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Download CSV reports built from live data for the selected period."
        actions={control}
      />
      <div className="grid gap-4 md:grid-cols-2">
        {reports.map((r) => (
          <Card key={r.title} flat>
            <CardHeader>
              <CardTitle className="text-base">{r.title}</CardTitle>
              <CardDescription>{r.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                disabled={!r.ready}
                onClick={() => {
                  const rows = r.rows();
                  if (!rows.length) return void toast.info("No data for this period.");
                  downloadCsv(
                    `ahq-${r.title.toLowerCase().replace(/\W+/g, "-")}-${days}d-${stamp}.csv`,
                    rows,
                  );
                }}
              >
                <Download /> {r.ready ? "Download CSV" : "Loading…"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <QueryState query={ai}>
        {(u) => (
          <ColumnChart
            title="AI cost per day (USD)"
            valueHeader="Cost"
            format={(n) => formatUsd(n)}
            data={u.series.map((s) => ({
              label: s.day,
              value: s.costUsd,
              note: `${s.requests} requests`,
            }))}
          />
        )}
      </QueryState>
    </div>
  );
}

// ---- Audit logs --------------------------------------------------------------------------------

export function AuditLogPage() {
  const [action, setAction] = useState("");
  const [target, setTarget] = useState("");
  const [page, setPage] = useState(1);
  const q = {
    action: action.trim() || undefined,
    targetId: target.trim() || undefined,
    page,
    pageSize: 25,
  };
  const logs = useQuery({ queryKey: ["admin-audit", q], queryFn: () => adminApi.auditLogs(q) });
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Append-only record of every privileged and security-relevant action."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          className="max-w-xs"
          placeholder="Action, or prefix like user."
          aria-label="Filter by action"
          value={action}
          onChange={(e) => (setAction(e.target.value), setPage(1))}
        />
        <Input
          className="max-w-xs"
          placeholder="Target id"
          aria-label="Filter by target"
          value={target}
          onChange={(e) => (setTarget(e.target.value), setPage(1))}
        />
      </div>
      <QueryState
        query={logs}
        isEmpty={(d) => d.items.length === 0}
        empty={<EmptyState title="No entries" />}
      >
        {(d) => (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.items.map((a) => (
                  <Fragment key={a.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => setOpen(open === a.id ? null : a.id)}
                    >
                      <TableCell className="whitespace-nowrap" title={formatDateTime(a.createdAt)}>
                        {relativeTime(a.createdAt)}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs font-bold">{a.action}</code>
                      </TableCell>
                      <TableCell className="text-xs">
                        {a.targetType} <span className="text-muted-foreground">{a.targetId}</span>
                      </TableCell>
                      <TableCell className="text-xs">
                        {a.actorRoles.join(", ")}{" "}
                        <span className="text-muted-foreground">{a.actorId.slice(-6)}</span>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm">{a.reason ?? "—"}</TableCell>
                    </TableRow>
                    {open === a.id && (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <div className="grid gap-2 text-xs md:grid-cols-2">
                            <pre className="overflow-x-auto rounded-lg bg-muted p-2">
                              Before: {JSON.stringify(a.before, null, 2)}
                            </pre>
                            <pre className="overflow-x-auto rounded-lg bg-muted p-2">
                              After: {JSON.stringify(a.after, null, 2)}
                            </pre>
                            <div>Request: {a.requestId ?? "—"}</div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
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
