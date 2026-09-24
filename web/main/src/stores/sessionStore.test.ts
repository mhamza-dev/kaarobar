import { beforeEach, describe, expect, it } from "vitest";

import type { Scope } from "@/types/api/me";

import {
  getTenantHeaders,
  rememberBusiness,
  rememberedBusiness,
  useSessionStore,
} from "./sessionStore";

const scope = {
  organization: { id: "org-1" },
  business: { id: "biz-grocery" },
  branch: { id: "branch-grocery" },
} as unknown as Scope;

describe("getTenantHeaders", () => {
  beforeEach(() => {
    useSessionStore.setState({ scope, pendingSelection: null });
  });

  it("sends the resolved tenant when nothing is pending", () => {
    expect(getTenantHeaders()).toEqual({
      "X-Organization-Id": "org-1",
      "X-Business-Id": "biz-grocery",
      "X-Branch-Id": "branch-grocery",
    });
  });

  it("drops the old branch when switching business", () => {
    useSessionStore.setState({
      pendingSelection: { organizationId: "org-1", businessId: "biz-restaurant" },
    });

    expect(getTenantHeaders()).toEqual({
      "X-Organization-Id": "org-1",
      "X-Business-Id": "biz-restaurant",
    });
  });

  it("drops the old business and branch when switching organization", () => {
    useSessionStore.setState({ pendingSelection: { organizationId: "org-2" } });

    expect(getTenantHeaders()).toEqual({ "X-Organization-Id": "org-2" });
  });

  it("keeps the organization when the bootstrap only names a business", () => {
    useSessionStore.setState({
      scope: { ...scope, business: null, branch: null } as unknown as Scope,
      pendingSelection: { businessId: "biz-first" },
    });

    expect(getTenantHeaders()).toEqual({
      "X-Organization-Id": "org-1",
      "X-Business-Id": "biz-first",
    });
  });
});

describe("rememberBusiness", () => {
  it("remembers the last business per organization", () => {
    rememberBusiness("org-1", "biz-a");
    rememberBusiness("org-2", "biz-b");

    expect(rememberedBusiness("org-1")).toBe("biz-a");
    expect(rememberedBusiness("org-2")).toBe("biz-b");
    expect(rememberedBusiness("org-3")).toBeNull();
  });
});
