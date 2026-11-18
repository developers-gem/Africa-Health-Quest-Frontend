import {
  BarChart3,
  Bot,
  ClipboardCheck,
  ClipboardList,
  FileClock,
  FileText,
  Flag,
  Globe2,
  LayoutDashboard,
  Megaphone,
  Library,
  ScrollText,
  Settings2,
  Stethoscope,
  UserCog,
  UserRound,
  Users,
} from "lucide-react";
import { createBrowserRouter, type RouteObject } from "react-router";
import { ConsoleLayout, type ConsoleNavItem } from "./layouts/ConsoleLayout";
import { PlayerLayout } from "./layouts/PlayerLayout";
import { PublicLayout } from "./layouts/PublicLayout";
import { NotFound, RouteError } from "./RouteError";

/** Lazily loads a named page component so each area ships as its own chunk. */
const page = (
  load: () => Promise<Record<string, unknown>>,
  name: string,
): Pick<RouteObject, "lazy"> => ({
  lazy: async () => ({ Component: (await load())[name] as React.ComponentType }),
});
const pub = () => import("@/features/public/pages");
const auth = () => import("@/features/auth/pages");
const play = () => import("@/features/player/pages");
const game = () => import("@/features/player/gameplay");
const account = () => import("@/features/player/account");
const rev = () => import("@/features/review/pages");
const adm = () => import("@/features/admin/pages");
const admContent = () => import("@/features/admin/content");
const admConfig = () => import("@/features/admin/config");

const REVIEW_NAV: ConsoleNavItem[] = [
  { to: "/review", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/review/assignments", label: "Assigned to me", icon: ClipboardList },
  { to: "/review/queue", label: "Review queue", icon: ClipboardCheck },
  { to: "/review/references", label: "References", icon: Library },
  { to: "/review/history", label: "Review history", icon: FileClock },
  { to: "/review/ai-flags", label: "Reported debriefs", icon: Flag },
  { to: "/review/profile", label: "Reviewer profile", icon: UserRound },
];

const ADMIN_NAV: ConsoleNavItem[] = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/users", label: "Users", icon: Users, perms: ["users:read"] },
  { to: "/admin/clinicians", label: "Clinicians", icon: Stethoscope, perms: ["clinicians:verify"] },
  { to: "/admin/countries", label: "Countries", icon: Globe2, perms: ["catalog:edit"] },
  { to: "/admin/missions", label: "Missions", icon: FileText, perms: ["content:read"] },
  {
    to: "/admin/publishing",
    label: "Publishing",
    icon: ClipboardCheck,
    perms: ["content:publish-control"],
  },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3, perms: ["analytics:read"] },
  { to: "/admin/reports", label: "Reports", icon: ScrollText, perms: ["analytics:read"] },
  { to: "/admin/ai", label: "AI settings", icon: Bot, perms: ["settings:read"] },
  { to: "/admin/configuration", label: "Configuration", icon: Settings2, perms: ["settings:read"] },
  {
    to: "/admin/announcements",
    label: "Announcements",
    icon: Megaphone,
    perms: ["notifications:broadcast"],
  },
  { to: "/admin/audit", label: "Audit log", icon: UserCog, perms: ["audit:read"] },
];

export const routes: RouteObject[] = [
  {
    errorElement: <RouteError />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          { index: true, ...page(pub, "LandingPage") },
          { path: "about", ...page(pub, "AboutPage") },
          { path: "how-to-play", ...page(pub, "HowToPlayPage") },
          { path: "learn", ...page(pub, "LearningPage") },
          { path: "countries", ...page(pub, "CountriesPage") },
          { path: "countries/:code", ...page(pub, "CountryPage") },
          {
            path: "status",
            ...page(() => import("@/features/system/SetupStatusPage"), "SetupStatusPage"),
          },
          { path: "login", ...page(auth, "LoginPage") },
          { path: "register", ...page(auth, "RegisterPage") },
          { path: "check-email", ...page(auth, "CheckEmailPage") },
          { path: "verify-email", ...page(auth, "VerifyEmailPage") },
          { path: "forgot-password", ...page(auth, "ForgotPasswordPage") },
          { path: "reset-password", ...page(auth, "ResetPasswordPage") },
        ],
      },
      {
        path: "play",
        element: <PlayerLayout />,
        children: [
          { index: true, ...page(play, "DashboardPage") },
          { path: "story", ...page(play, "StoryModePage") },
          { path: "challenge", ...page(play, "ChallengePage") },
          { path: "missions", ...page(play, "MissionListPage") },
          { path: "missions/:key", ...page(play, "MissionDetailPage") },
          { path: "attempts/:id", ...page(game, "AttemptPage") },
          { path: "commander", ...page(play, "CommanderPage") },
          { path: "countries", ...page(play, "CountryExpansionPage") },
          { path: "profile", ...page(account, "ProfilePage") },
          { path: "achievements", ...page(account, "AchievementsPage") },
          { path: "history", ...page(account, "HistoryPage") },
          { path: "settings", ...page(account, "SettingsPage") },
        ],
      },
      {
        path: "review/profile",
        element: <PublicLayout />,
        children: [{ index: true, ...page(rev, "ReviewerProfilePage") }],
      },
      {
        path: "review",
        element: (
          <ConsoleLayout title="Clinician review" items={REVIEW_NAV} perms={["review:read"]} />
        ),
        children: [
          { index: true, ...page(rev, "ReviewDashboardPage") },
          { path: "assignments", ...page(rev, "AssignmentsPage") },
          { path: "queue", ...page(rev, "QueuePage") },
          { path: "versions/:id", ...page(rev, "ReviewVersionPage") },
          { path: "references", ...page(rev, "ReferencesPage") },
          { path: "history", ...page(rev, "ReviewHistoryPage") },
          { path: "missions/:key", ...page(rev, "MissionHistoryPage") },
          { path: "ai-flags", ...page(rev, "AiFlagsPage") },
        ],
      },
      {
        path: "admin",
        element: <ConsoleLayout title="Administration" items={ADMIN_NAV} perms={["users:read"]} />,
        children: [
          { index: true, ...page(adm, "AdminOverviewPage") },
          { path: "users", ...page(adm, "UsersPage") },
          { path: "users/:id", ...page(adm, "UserDetailPage") },
          { path: "clinicians", ...page(adm, "CliniciansPage") },
          { path: "clinicians/:id", ...page(adm, "ClinicianDetailPage") },
          { path: "analytics", ...page(adm, "AnalyticsPage") },
          { path: "reports", ...page(adm, "ReportsPage") },
          { path: "audit", ...page(adm, "AuditLogPage") },
          { path: "countries", ...page(admContent, "AdminCountriesPage") },
          { path: "countries/:code", ...page(admContent, "AdminCountryPage") },
          { path: "missions", ...page(admContent, "AdminMissionsPage") },
          { path: "missions/new", ...page(admContent, "NewMissionPage") },
          { path: "missions/:key", ...page(admContent, "AdminMissionPage") },
          { path: "versions/:id", ...page(admContent, "VersionEditorPage") },
          { path: "publishing", ...page(admContent, "PublishingPage") },
          { path: "ai", ...page(admConfig, "AiSettingsPage") },
          { path: "configuration", ...page(admConfig, "ConfigurationPage") },
          { path: "announcements", ...page(admConfig, "AnnouncementsPage") },
        ],
      },
      { path: "*", element: <PublicLayout />, children: [{ path: "*", element: <NotFound /> }] },
    ],
  },
];

export const router = createBrowserRouter(routes);
