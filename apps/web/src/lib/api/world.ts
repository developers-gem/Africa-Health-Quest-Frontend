import { API_PREFIX } from "@ahq/shared-types";
import { apiFetch } from "./client";
import type { Catalog, Country, HospitalRunPage, HospitalState, ShiftResult } from "./types";

export const countriesApi = {
  list: () => apiFetch<{ items: Country[] }>(`${API_PREFIX}/countries`),
  get: (code: string) =>
    apiFetch<Country & { missionKeys?: string[] }>(`${API_PREFIX}/countries/${code}`),
};
export const catalogApi = { get: () => apiFetch<Catalog>(`${API_PREFIX}/catalog`) };

const H = `${API_PREFIX}/hospital`;
export type AllocationInput = { staff: number; beds: number; ambulances: number; supplies: number };
export const hospitalApi = {
  state: () => apiFetch<HospitalState>(`${H}/state`),
  run: (allocation: AllocationInput) =>
    apiFetch<ShiftResult>(`${H}/runs`, { method: "POST", body: { allocation }, idempotent: true }),
  runs: (page = 1, pageSize = 10) =>
    apiFetch<HospitalRunPage>(`${H}/runs`, { query: { page, pageSize } }),
};
