import { describe, expect, it } from "vitest";

import { getVisibleNavGroups } from "./nav";
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

function hrefsFor(scope: Scope | null): string[] {
  return getVisibleNavGroups(scope).flatMap((group) => group.items.map((item) => item.href));
}

/**
 * The Phase 1 gate in test form: a cashier must see a visibly smaller
 * sidebar than an owner. A regression here silently hands one role another
 * role's screens, which is exactly the bug permission gating exists to
 * prevent.
 */
describe("getVisibleNavGroups", () => {
  it("shows an owner everything, without needing explicit permissions", () => {
    const owner = scopeWith({ is_owner: true, permissions: [] });
    const hrefs = hrefsFor(owner);

    expect(hrefs).toContain("/settings/staff");
    expect(hrefs).toContain("/settings/roles");
    expect(hrefs).toContain("/settings/organization");
    expect(hrefs).toContain("/products");
  });

  it("shows a cashier a strictly smaller sidebar than an owner", () => {
    const cashier = scopeWith({ permissions: ["product:view"] });
    const owner = scopeWith({ is_owner: true });

    const cashierHrefs = hrefsFor(cashier);
    const ownerHrefs = hrefsFor(owner);

    expect(cashierHrefs.length).toBeLessThan(ownerHrefs.length);
    expect(new Set(ownerHrefs)).toEqual(new Set([...ownerHrefs, ...cashierHrefs]));
  });

  it("hides every settings screen from someone with no settings permissions", () => {
    const hrefs = hrefsFor(scopeWith({ permissions: ["product:view"] }));

    expect(hrefs.some((href) => href.startsWith("/settings"))).toBe(false);
    expect(hrefs).toContain("/products");
  });

  it("shows only the settings screens a permission actually covers", () => {
    const hrefs = hrefsFor(scopeWith({ permissions: ["branch:view"] }));

    expect(hrefs).toContain("/settings/branches");
    expect(hrefs).not.toContain("/settings/organization");
    expect(hrefs).not.toContain("/settings/roles");
    expect(hrefs).not.toContain("/settings/staff");
  });

  it("always shows the dashboard, which needs no permission", () => {
    expect(hrefsFor(scopeWith({ permissions: [] }))).toEqual(["/dashboard"]);
  });

  it("drops groups that end up empty rather than rendering a bare heading", () => {
    const groups = getVisibleNavGroups(scopeWith({ permissions: [] }));

    expect(groups.every((group) => group.items.length > 0)).toBe(true);
  });

  it("shows nothing at all without a scope", () => {
    expect(hrefsFor(null)).toEqual(["/dashboard"]);
  });
});
