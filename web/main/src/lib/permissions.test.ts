import { describe, expect, it } from "vitest";

import { can, canAll, canAny } from "./permissions";
import type { Scope } from "@/types/api/me";

function scopeWith(overrides: Partial<Scope>): Scope {
  return {
    user: null,
    organization: null,
    business: null,
    branch: null,
    is_owner: false,
    roles: [],
    permissions: [],
    branch_ids: null,
    organizations: [],
    ...overrides,
  };
}

describe("can", () => {
  it("is false without a scope at all", () => {
    expect(can(null, "product:view")).toBe(false);
  });

  it("grants a permission the scope actually holds", () => {
    const scope = scopeWith({ permissions: ["product:view", "staff:view"] });
    expect(can(scope, "product:view")).toBe(true);
    expect(can(scope, "product:create")).toBe(false);
  });

  it("grants everything to the owner regardless of their permission list", () => {
    // Mirrors Kaarobar.Scope.can?/2 — an owner cannot lock themselves out of
    // their own account, so this must not depend on how the owner role's
    // permission set happens to be seeded.
    const owner = scopeWith({ is_owner: true, permissions: [] });
    expect(can(owner, "product:delete")).toBe(true);
    expect(can(owner, "anything:at:all")).toBe(true);
  });
});

describe("canAny / canAll", () => {
  const scope = scopeWith({ permissions: ["product:view", "staff:view"] });

  it("canAny needs one match", () => {
    expect(canAny(scope, ["product:create", "staff:view"])).toBe(true);
    expect(canAny(scope, ["product:create", "role:edit"])).toBe(false);
  });

  it("canAll needs every match", () => {
    expect(canAll(scope, ["product:view", "staff:view"])).toBe(true);
    expect(canAll(scope, ["product:view", "role:edit"])).toBe(false);
  });

  it("both are empty-safe", () => {
    expect(canAny(scope, [])).toBe(false);
    expect(canAll(scope, [])).toBe(true);
  });
});
