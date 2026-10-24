import { describe, expect, it } from "vitest";

import { createActions } from "./createActions";
import { goToShortcuts, isTypingTarget } from "./shortcuts";
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

describe("goToShortcuts", () => {
  it("offers only the jumps to screens this person can open", () => {
    const cashier = scopeWith({ permissions: ["sales:checkout", "product:view"] });
    const keys = goToShortcuts(cashier).map((shortcut) => shortcut.href);

    expect(keys).toEqual(["/dashboard", "/pos", "/products"]);
  });

  it("labels each jump as the sidebar does", () => {
    const owner = scopeWith({ is_owner: true });
    expect(goToShortcuts(owner).find((shortcut) => shortcut.key === "t")?.label).toBe("Till");
  });
});

describe("createActions", () => {
  it("needs the create permission, not just the list", () => {
    const viewer = scopeWith({ permissions: ["product:view"] });
    const creator = scopeWith({ permissions: ["product:view", "product:create"] });

    expect(createActions(viewer).map((action) => action.href)).not.toContain("/products/new");
    expect(createActions(creator).map((action) => action.href)).toContain("/products/new");
  });

  it("leaves out a module the business doesn't run", () => {
    const owner = scopeWith({ is_owner: true, business: null });
    expect(createActions(owner).map((action) => action.href)).not.toContain("/service-jobs/new");
  });
});

describe("isTypingTarget", () => {
  it("treats text fields as typing and buttons as not", () => {
    const input = document.createElement("input");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";

    expect(isTypingTarget(input)).toBe(true);
    expect(isTypingTarget(document.createElement("textarea"))).toBe(true);
    expect(isTypingTarget(checkbox)).toBe(false);
    expect(isTypingTarget(document.createElement("button"))).toBe(false);
  });
});
