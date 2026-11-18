import { API_PREFIX } from "@ahq/shared-types";
import { apiFetch } from "./client";
import type { AnswerResponse, Attempt, Debrief, MissionDetail, MissionSummary } from "./types";

export type MissionMode = "story" | "practice";
export const missionsApi = {
  list: (q: { mode?: MissionMode; country?: string; topic?: string } = {}) =>
    apiFetch<{ items: MissionSummary[] }>(`${API_PREFIX}/missions`, { query: q }),
  random: (q: { mode?: MissionMode; exclude?: string } = {}) =>
    apiFetch<MissionSummary>(`${API_PREFIX}/missions/random`, { query: q }),
  detail: (key: string) =>
    apiFetch<MissionDetail>(`${API_PREFIX}/missions/${encodeURIComponent(key)}`),
};

const T = `${API_PREFIX}/attempts`;
export const attemptsApi = {
  start: (missionKey: string, mode: MissionMode) =>
    apiFetch<Attempt>(T, { method: "POST", body: { missionKey, mode }, idempotent: true }),
  get: (id: string) => apiFetch<Attempt>(`${T}/${id}`),
  answer: (id: string, body: { stepId: string; choiceId: string; reasoning?: string }) =>
    apiFetch<AnswerResponse>(`${T}/${id}/answers`, { method: "POST", body, idempotent: true }),
  abandon: (id: string) => apiFetch<Attempt>(`${T}/${id}/abandon`, { method: "POST", body: {} }),
};

export const aiApi = {
  status: () => apiFetch<import("./types").AiStatus>(`${API_PREFIX}/ai/status`),
  consent: () =>
    apiFetch<import("./types").AiStatus>(`${API_PREFIX}/ai/consent`, {
      method: "POST",
      body: { accepted: true },
    }),
  request: (attemptId: string, level: string, regenerate = false) =>
    apiFetch<Debrief>(`${T}/${attemptId}/debriefs`, {
      method: "POST",
      body: { level, ...(regenerate ? { regenerate } : {}) },
      idempotent: true,
    }),
  list: (attemptId: string) => apiFetch<{ items: Debrief[] }>(`${T}/${attemptId}/debriefs`),
  get: (id: string) => apiFetch<Debrief>(`${API_PREFIX}/debriefs/${id}`),
  flag: (id: string, reason: string, comment?: string) =>
    apiFetch<{ message: string }>(`${API_PREFIX}/debriefs/${id}/flags`, {
      method: "POST",
      body: { reason, ...(comment ? { comment } : {}) },
    }),
};
