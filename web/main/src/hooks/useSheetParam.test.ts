import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSheetParam } from "./useSheetParam";

const push = vi.fn();
const replace = vi.fn();
let search = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => "/suppliers",
  useSearchParams: () => new URLSearchParams(search),
}));

describe("useSheetParam", () => {
  beforeEach(() => {
    push.mockClear();
    replace.mockClear();
    search = "";
  });

  it("reads the open record from the URL", () => {
    search = "view=abc";
    expect(renderHook(() => useSheetParam()).result.current.value).toBe("abc");
  });

  it("pushes on open, so Back closes the sheet", () => {
    search = "status=active";
    const { result } = renderHook(() => useSheetParam());
    act(() => result.current.open("abc"));
    expect(push).toHaveBeenCalledWith("/suppliers?status=active&view=abc", { scroll: false });
  });

  it("replaces on close and keeps the list's own filters", () => {
    search = "status=active&view=abc";
    const { result } = renderHook(() => useSheetParam());
    act(() => result.current.close());
    expect(replace).toHaveBeenCalledWith("/suppliers?status=active", { scroll: false });
  });
});
