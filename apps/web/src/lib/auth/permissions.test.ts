import { describe, expect, it } from "vitest";
import { can, isStaff, permissionsOf } from "./permissions";

const u = (roles: string[]) => ({ roles }) as never;

describe("client-side permissions (UI only; the API enforces them)", () => {
  it("derives permissions from roles", () => {
    expect(can(u(["player"]), "game:play")).toBe(true);
    expect(can(u(["player"]), "review:read")).toBe(false);
    expect(can(u(["player", "reviewer"]), "review:decide")).toBe(true);
    expect(can(null, "game:play")).toBe(false);
  });

  it("keeps separation of duties: admins cannot decide reviews", () => {
    expect(can(u(["player", "admin"]), "users:manage", "settings:edit")).toBe(true);
    expect(can(u(["player", "admin"]), "review:decide")).toBe(false);
    expect(permissionsOf(u(["player", "admin"])).has("review:read")).toBe(true);
  });

  it("identifies staff", () => {
    expect(isStaff(u(["player"]))).toBe(false);
    expect(isStaff(u(["player", "reviewer"]))).toBe(true);
  });
});
