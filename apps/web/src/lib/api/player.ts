import { API_PREFIX } from "@ahq/shared-types";
import type { UpdatePlayerProfile } from "@ahq/api-contracts";
import { apiFetch } from "./client";
import type {
  AttemptHistoryPage,
  LedgerPage,
  PlayerAchievements,
  PlayerProfile,
  PlayerStats,
  Progress,
} from "./types";

const P = `${API_PREFIX}/players/me`;
export const playerApi = {
  progress: () => apiFetch<Progress>(`${P}/progress`),
  profile: () => apiFetch<PlayerProfile>(`${P}/profile`),
  updateProfile: (body: UpdatePlayerProfile) =>
    apiFetch<PlayerProfile>(`${P}/profile`, { method: "PATCH", body }),
  stats: () => apiFetch<PlayerStats>(`${P}/stats`),
  achievements: () => apiFetch<PlayerAchievements>(`${P}/achievements`),
  ledger: (page = 1, pageSize = 20) =>
    apiFetch<LedgerPage>(`${P}/ledger`, { query: { page, pageSize } }),
  attempts: (q: {
    page?: number;
    pageSize?: number;
    mode?: string;
    status?: string;
    missionKey?: string;
  }) => apiFetch<AttemptHistoryPage>(`${P}/attempts`, { query: q }),
};
