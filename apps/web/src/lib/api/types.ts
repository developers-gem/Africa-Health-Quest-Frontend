/** Response/request types inferred from the shared contracts (type-only imports: no runtime cost). */
import type {
  z,
  AdminAchievementSchema,
  AdminClinicianSchema,
  AdminCountrySchema,
  AdminMissionPageSchema,
  AdminMissionSchema,
  AdminPlayerSchema,
  AdminUserListResponseSchema,
  AiFlagListSchema,
  AiSettingsSchema,
  AiStatusSchema,
  AiUsageSchema,
  AiProviderStatusSchema,
  ApprovalMonitorSchema,
  AnalyticsOverviewSchema,
  AnswerResponseSchema,
  AssignmentSchema,
  AttemptHistoryPageSchema,
  AttemptSchema,
  AuditLogPageSchema,
  ClinicianProfileSchema,
  CountrySchema,
  DebriefSchema,
  EconomySettingsSchema,
  FullReferenceSchema,
  FullVersionSchema,
  FunnelSchema,
  HospitalEventSchema,
  HospitalRunPageSchema,
  HospitalSettingsSchema,
  HospitalStateSchema,
  LedgerPageSchema,
  MediaAssetSchema,
  MissionAnalyticsSchema,
  MissionDetailSchema,
  MissionHistorySchema,
  MissionSummarySchema,
  PlayerAchievementsSchema,
  PlayerProfileSchema,
  PlayerStatsSchema,
  ProgressSchema,
  ProgressionSettingsSchema,
  ReviewQueuePageSchema,
  ReviewSchema,
  ReviewVersionDetailSchema,
  RoleCatalogSchema,
  SettingVersionSchema,
  ShiftResultSchema,
  TierSchema,
  User as UserT,
  SessionSummary as SessionSummaryT,
  VersionDiffSchema,
  CatalogSchema,
} from "@ahq/api-contracts";

export type User = UserT;
export type SessionSummary = SessionSummaryT;
export type Tier = z.infer<typeof TierSchema>;
export type Progress = z.infer<typeof ProgressSchema>;
export type PlayerProfile = z.infer<typeof PlayerProfileSchema>;
export type PlayerStats = z.infer<typeof PlayerStatsSchema>;
export type PlayerAchievements = z.infer<typeof PlayerAchievementsSchema>;
export type LedgerPage = z.infer<typeof LedgerPageSchema>;
export type Country = z.infer<typeof CountrySchema>;
export type MissionSummary = z.infer<typeof MissionSummarySchema>;
export type MissionDetail = z.infer<typeof MissionDetailSchema>;
export type Attempt = z.infer<typeof AttemptSchema>;
export type AnswerResponse = z.infer<typeof AnswerResponseSchema>;
export type AttemptHistoryPage = z.infer<typeof AttemptHistoryPageSchema>;
export type HospitalState = z.infer<typeof HospitalStateSchema>;
export type HospitalSettings = z.infer<typeof HospitalSettingsSchema>;
export type ShiftResult = z.infer<typeof ShiftResultSchema>;
export type HospitalRunPage = z.infer<typeof HospitalRunPageSchema>;
export type HospitalEvent = z.infer<typeof HospitalEventSchema>;
export type Debrief = z.infer<typeof DebriefSchema>;
export type AiStatus = z.infer<typeof AiStatusSchema>;
export type AiSettings = z.infer<typeof AiSettingsSchema>;
export type AiUsage = z.infer<typeof AiUsageSchema>;
export type AiProviderStatus = z.infer<typeof AiProviderStatusSchema>;
export type ApprovalMonitor = z.infer<typeof ApprovalMonitorSchema>;
export type AiFlagList = z.infer<typeof AiFlagListSchema>;
export type ClinicianProfile = z.infer<typeof ClinicianProfileSchema>;
export type AdminClinician = z.infer<typeof AdminClinicianSchema>;
export type ReviewQueuePage = z.infer<typeof ReviewQueuePageSchema>;
export type ReviewVersionDetail = z.infer<typeof ReviewVersionDetailSchema>;
export type Review = z.infer<typeof ReviewSchema>;
export type MissionHistory = z.infer<typeof MissionHistorySchema>;
export type Assignment = z.infer<typeof AssignmentSchema>;
export type FullReference = z.infer<typeof FullReferenceSchema>;
export type FullVersion = z.infer<typeof FullVersionSchema>;
export type VersionDiff = z.infer<typeof VersionDiffSchema>;
export type AdminMission = z.infer<typeof AdminMissionSchema>;
export type AdminMissionPage = z.infer<typeof AdminMissionPageSchema>;
export type AdminCountry = z.infer<typeof AdminCountrySchema>;
export type AdminPlayer = z.infer<typeof AdminPlayerSchema>;
export type AdminAchievement = z.infer<typeof AdminAchievementSchema>;
export type AdminUserList = z.infer<typeof AdminUserListResponseSchema>;
export type MediaAsset = z.infer<typeof MediaAssetSchema>;
export type AnalyticsOverview = z.infer<typeof AnalyticsOverviewSchema>;
export type MissionAnalytics = z.infer<typeof MissionAnalyticsSchema>;
export type Funnel = z.infer<typeof FunnelSchema>;
export type AuditLogPage = z.infer<typeof AuditLogPageSchema>;
export type RoleCatalog = z.infer<typeof RoleCatalogSchema>;
export type SettingVersion = z.infer<typeof SettingVersionSchema>;
export type EconomySettings = z.infer<typeof EconomySettingsSchema>;
export type ProgressionSettings = z.infer<typeof ProgressionSettingsSchema>;
export type Catalog = z.infer<typeof CatalogSchema>;
export type Page<T> = { items: T[]; page: number; pageSize: number; total: number };
