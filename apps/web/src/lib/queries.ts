import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "@/lib/auth/session-store";
import { aiApi, missionsApi, type MissionMode } from "@/lib/api/missions";
import { playerApi } from "@/lib/api/player";
import { countriesApi, hospitalApi } from "@/lib/api/world";

/** Central query keys so mutations can invalidate precisely. */
export const qk = {
  progress: ["progress"] as const,
  profile: ["profile"] as const,
  stats: ["stats"] as const,
  achievements: ["achievements"] as const,
  missions: (mode: MissionMode, country?: string) => ["missions", mode, country ?? null] as const,
  mission: (key: string) => ["mission", key] as const,
  attempt: (id: string) => ["attempt", id] as const,
  attempts: (q: object) => ["attempts", q] as const,
  countries: ["countries"] as const,
  country: (code: string) => ["country", code] as const,
  hospital: ["hospital"] as const,
  hospitalRuns: (page: number) => ["hospital-runs", page] as const,
  aiStatus: ["ai-status"] as const,
  debriefs: (attemptId: string) => ["debriefs", attemptId] as const,
};

export function useIsSignedIn() {
  return useSessionStore((s) => s.status === "authenticated");
}
export function useProgress() {
  const signedIn = useIsSignedIn();
  return useQuery({ queryKey: qk.progress, queryFn: playerApi.progress, enabled: signedIn });
}
export function useMissions(mode: MissionMode, country?: string) {
  const status = useSessionStore((s) => s.status);
  // Lock state depends on the signed-in player, so include the session in the key.
  return useQuery({
    queryKey: [...qk.missions(mode, country), status],
    queryFn: () => missionsApi.list({ mode, ...(country ? { country } : {}) }),
    enabled: status !== "unknown",
  });
}
export function useCountries() {
  const status = useSessionStore((s) => s.status);
  return useQuery({
    queryKey: [...qk.countries, status],
    queryFn: countriesApi.list,
    enabled: status !== "unknown",
    staleTime: 60_000,
  });
}
export function useHospitalState() {
  return useQuery({ queryKey: qk.hospital, queryFn: hospitalApi.state, enabled: useIsSignedIn() });
}
export function useAiStatus() {
  return useQuery({ queryKey: qk.aiStatus, queryFn: aiApi.status, enabled: useIsSignedIn() });
}

/** After any server-side change to HP/funding/unlocks. */
export function useInvalidateProgress() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: qk.progress }),
      qc.invalidateQueries({ queryKey: ["missions"] }),
      qc.invalidateQueries({ queryKey: qk.countries }),
      qc.invalidateQueries({ queryKey: qk.hospital }),
      qc.invalidateQueries({ queryKey: qk.stats }),
      qc.invalidateQueries({ queryKey: qk.achievements }),
      qc.invalidateQueries({ queryKey: ["attempts"] }),
    ]);
}
