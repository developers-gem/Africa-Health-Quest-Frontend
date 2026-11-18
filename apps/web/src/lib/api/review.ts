import { API_PREFIX } from "@ahq/shared-types";
import type { ClinicianProfileInput, ReviewDecisionInput } from "@ahq/api-contracts";
import { apiFetch } from "./client";
import type {
  AiFlagList,
  Assignment,
  ClinicianProfile,
  FullReference,
  MediaAsset,
  MissionHistory,
  Page,
  Review,
  ReviewQueuePage,
  ReviewVersionDetail,
} from "./types";

const R = `${API_PREFIX}/review`;
export const reviewApi = {
  queue: (q: {
    status?: string;
    assigned?: "me" | "any";
    country?: string;
    page?: number;
    pageSize?: number;
  }) => apiFetch<ReviewQueuePage>(`${R}/queue`, { query: q }),
  version: (id: string) => apiFetch<ReviewVersionDetail>(`${R}/versions/${id}`),
  decide: (id: string, body: ReviewDecisionInput) =>
    apiFetch<Review>(`${R}/versions/${id}/decisions`, { method: "POST", body }),
  history: (key: string) => apiFetch<MissionHistory>(`${R}/missions/${key}/history`),
  assignments: () => apiFetch<{ items: Assignment[] }>(`${R}/assignments`),
  references: (q: {
    search?: string;
    status?: string;
    topic?: string;
    page?: number;
    pageSize?: number;
  }) => apiFetch<Page<FullReference>>(`${R}/references`, { query: q }),
  createReference: (body: Record<string, unknown>) =>
    apiFetch<FullReference>(`${R}/references`, { method: "POST", body }),
  updateReference: (id: string, body: Record<string, unknown>) =>
    apiFetch<FullReference>(`${R}/references/${id}`, { method: "PATCH", body }),
  aiFlags: () => apiFetch<AiFlagList>(`${R}/ai-flags`),
};

const U = `${API_PREFIX}/users/me`;
export const clinicianApi = {
  profile: () => apiFetch<ClinicianProfile>(`${U}/clinician-profile`),
  submit: (body: ClinicianProfileInput) =>
    apiFetch<ClinicianProfile>(`${U}/clinician-profile`, { method: "PUT", body }),
  uploadEvidence: (file: File) =>
    apiFetch<MediaAsset>(`${U}/clinician-evidence`, {
      method: "POST",
      rawBody: file,
      query: { filename: file.name },
    }),
};
