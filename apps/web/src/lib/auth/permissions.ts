import { SYSTEM_ROLES, type Permission, type Role } from "@ahq/shared-types";
import type { User } from "@ahq/api-contracts";
import { useSessionStore } from "./session-store";

/** Client-side permission check for showing UI. The API enforces every permission on the server. */
export function permissionsOf(user: User | null): Set<Permission> {
  const out = new Set<Permission>();
  for (const role of user?.roles ?? [])
    for (const p of SYSTEM_ROLES[role as Role]?.permissions ?? []) out.add(p);
  return out;
}
export function can(user: User | null, ...perms: Permission[]) {
  const have = permissionsOf(user);
  return perms.every((p) => have.has(p));
}
export function useCan(...perms: Permission[]) {
  const user = useSessionStore((s) => s.user);
  return can(user, ...perms);
}
export const isStaff = (user: User | null) => Boolean(user?.roles.some((r) => r !== "player"));
