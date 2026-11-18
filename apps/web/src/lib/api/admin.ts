import { API_PREFIX } from "@ahq/shared-types";
import { apiFetch } from "./client";
import type {
  AdminAchievement,
  AdminClinician,
  AdminCountry,
  AdminMission,
  AdminMissionPage,
  AdminPlayer,
  AdminUserList,
  AiProviderStatus,
  AiUsage,
  ApprovalMonitor,
  AnalyticsOverview,
  Assignment,
  AuditLogPage,
  FullVersion,
  Funnel,
  HospitalEvent,
  MediaAsset,
  MissionAnalytics,
  MissionHistory,
  Page,
  RoleCatalog,
  SettingVersion,
  User,
  VersionDiff,
} from "./types";

const A = `${API_PREFIX}/admin`;
type Range = { from?: string; to?: string };

export const adminApi = {
  // Users
  users: (q: { search?: string; role?: string; page?: number; pageSize?: number }) =>
    apiFetch<AdminUserList>(`${A}/users`, { query: q }),
  user: (id: string) => apiFetch<User>(`${A}/users/${id}`),
  player: (id: string) => apiFetch<AdminPlayer>(`${A}/players/${id}`),
  setRoles: (id: string, roles: string[], reason?: string) =>
    apiFetch<User>(`${A}/users/${id}/roles`, {
      method: "PUT",
      body: { roles, ...(reason ? { reason } : {}) },
    }),
  suspend: (id: string, reason: string) =>
    apiFetch<User>(`${A}/users/${id}/suspend`, { method: "POST", body: { reason } }),
  unsuspend: (id: string, reason: string) =>
    apiFetch<User>(`${A}/users/${id}/unsuspend`, { method: "POST", body: { reason } }),
  revokeSessions: (id: string) =>
    apiFetch<void>(`${A}/users/${id}/sessions/revoke`, { method: "POST", body: {} }),
  adjust: (id: string, body: { hp: number; funding: number; reason: string }) =>
    apiFetch<AdminPlayer>(`${A}/players/${id}/adjustments`, { method: "POST", body }),
  erase: (id: string, body: { reason: string; confirmEmail: string }) =>
    apiFetch<{ userId: string; documentsDeleted: number }>(`${A}/users/${id}/erase`, {
      method: "POST",
      body,
    }),
  roles: () => apiFetch<RoleCatalog>(`${A}/roles`),

  // Clinicians
  clinicians: (status?: string) =>
    apiFetch<{ items: AdminClinician[] }>(`${A}/clinicians`, { query: { status } }),
  clinician: (id: string) => apiFetch<AdminClinician>(`${A}/clinicians/${id}`),
  verifyClinician: (id: string, decision: "verified" | "rejected", reason: string) =>
    apiFetch<AdminClinician>(`${A}/clinicians/${id}/verify`, {
      method: "POST",
      body: { decision, reason },
    }),

  // Countries and media
  countries: (q: { status?: string; region?: string; search?: string } = {}) =>
    apiFetch<{ items: AdminCountry[] }>(`${A}/countries`, { query: q }),
  country: (code: string) => apiFetch<AdminCountry>(`${A}/countries/${code}`),
  createCountry: (body: Record<string, unknown>) =>
    apiFetch<AdminCountry>(`${A}/countries`, { method: "POST", body }),
  updateCountry: (code: string, body: Record<string, unknown>) =>
    apiFetch<AdminCountry>(`${A}/countries/${code}`, { method: "PATCH", body }),
  assignMissions: (code: string, missionKeys: string[]) =>
    apiFetch<{
      items: { missionKey: string; action: string; versionNumber: number | null }[];
      note: string;
    }>(`${A}/countries/${code}/missions`, { method: "PUT", body: { missionKeys } }),
  upload: (file: File, purpose: string) =>
    apiFetch<MediaAsset>(`${A}/media`, {
      method: "POST",
      rawBody: file,
      query: { purpose, filename: file.name },
    }),
  media: (q: { purpose?: string; page?: number } = {}) =>
    apiFetch<Page<MediaAsset>>(`${A}/media`, { query: q }),
  deleteMedia: (id: string) => apiFetch<void>(`${A}/media/${id}`, { method: "DELETE" }),

  // Missions and publishing
  missions: (q: {
    status?: string;
    country?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }) => apiFetch<AdminMissionPage>(`${A}/missions`, { query: q }),
  mission: (key: string) =>
    apiFetch<{ mission: AdminMission; history: MissionHistory }>(`${A}/missions/${key}`),
  createMission: (body: Record<string, unknown>) =>
    apiFetch<{ mission: AdminMission; version: FullVersion }>(`${A}/missions`, {
      method: "POST",
      body,
    }),
  updatePlacement: (key: string, body: Record<string, unknown>) =>
    apiFetch<AdminMission>(`${A}/missions/${key}`, { method: "PATCH", body }),
  newDraft: (key: string) =>
    apiFetch<FullVersion>(`${A}/missions/${key}/drafts`, { method: "POST", body: {} }),
  publishControl: (key: string, action: "withdraw" | "restore" | "retire", reason: string) =>
    apiFetch<AdminMission>(`${A}/missions/${key}/${action}`, { method: "POST", body: { reason } }),
  rollback: (key: string, versionNumber: number, reason: string) =>
    apiFetch<AdminMission>(`${A}/missions/${key}/rollback`, {
      method: "POST",
      body: { versionNumber, reason },
    }),
  version: (id: string) => apiFetch<FullVersion>(`${A}/versions/${id}`),
  diff: (id: string) => apiFetch<VersionDiff>(`${A}/versions/${id}/diff`),
  updateDraft: (id: string, body: Record<string, unknown>) =>
    apiFetch<FullVersion>(`${A}/versions/${id}`, { method: "PATCH", body }),
  submitDraft: (id: string, changeSummary: string) =>
    apiFetch<FullVersion>(`${A}/versions/${id}/submit`, {
      method: "POST",
      body: { changeSummary },
    }),
  discardDraft: (id: string) => apiFetch<void>(`${A}/versions/${id}`, { method: "DELETE" }),
  assignments: () => apiFetch<{ items: Assignment[] }>(`${A}/reviews/assignments`),
  assign: (versionId: string, reviewerId: string) =>
    apiFetch<Assignment>(`${A}/reviews/assignments`, {
      method: "POST",
      body: { versionId, reviewerId },
    }),
  cancelAssignment: (id: string) =>
    apiFetch<void>(`${A}/reviews/assignments/${id}`, { method: "DELETE" }),

  // Hospital events and achievements
  hospitalEvents: () => apiFetch<{ items: HospitalEvent[] }>(`${A}/hospital/events`),
  createHospitalEvent: (body: Record<string, unknown>) =>
    apiFetch<HospitalEvent>(`${A}/hospital/events`, { method: "POST", body }),
  updateHospitalEvent: (key: string, body: Record<string, unknown>) =>
    apiFetch<HospitalEvent>(`${A}/hospital/events/${key}`, { method: "PATCH", body }),
  achievements: () => apiFetch<{ items: AdminAchievement[] }>(`${A}/achievements`),
  createAchievement: (body: Record<string, unknown>) =>
    apiFetch<AdminAchievement>(`${A}/achievements`, { method: "POST", body }),
  updateAchievement: (key: string, body: Record<string, unknown>) =>
    apiFetch<AdminAchievement>(`${A}/achievements/${key}`, { method: "PATCH", body }),

  announce: (body: {
    title: string;
    body: string;
    route?: string;
    audience: { roles?: string[]; countries?: string[] };
    push: boolean;
  }) =>
    apiFetch<{ recipients: number; pushQueued: number }>(`${A}/announcements`, {
      method: "POST",
      body,
    }),

  // Settings, audit, analytics, AI
  settings: () => apiFetch<{ items: SettingVersion[] }>(`${A}/settings`),
  setting: (key: string) => apiFetch<SettingVersion>(`${A}/settings/${key}`),
  settingHistory: (key: string, page = 1) =>
    apiFetch<Page<SettingVersion>>(`${A}/settings/${key}/history`, {
      query: { page, pageSize: 20 },
    }),
  updateSetting: (
    key: string,
    body: { value: Record<string, unknown>; changeNote: string; expectedVersion: number },
  ) => apiFetch<SettingVersion>(`${A}/settings/${key}`, { method: "PUT", body }),
  auditLogs: (q: Record<string, string | number | undefined>) =>
    apiFetch<AuditLogPage>(`${A}/audit-logs`, { query: q }),
  overview: (r: Range = {}) => apiFetch<AnalyticsOverview>(`${A}/analytics/overview`, { query: r }),
  missionAnalytics: (r: Range & { country?: string } = {}) =>
    apiFetch<MissionAnalytics>(`${A}/analytics/missions`, { query: r }),
  funnel: (r: Range = {}) => apiFetch<Funnel>(`${A}/analytics/funnel`, { query: r }),
  aiUsage: (r: Range = {}) => apiFetch<AiUsage>(`${A}/ai/usage`, { query: r }),
  aiProvider: () => apiFetch<AiProviderStatus>(`${A}/ai/provider`),
  approvals: () => apiFetch<ApprovalMonitor>(`${A}/content/approvals`),
};
