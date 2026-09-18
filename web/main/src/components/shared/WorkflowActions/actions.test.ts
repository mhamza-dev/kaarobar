import { describe, expect, it, vi } from "vitest";

import { isWorkflowIdle, visibleWorkflowActions, type WorkflowAction } from "./actions";

function action(overrides: Partial<WorkflowAction> = {}): WorkflowAction {
  return {
    key: "dispatch",
    label: "Dispatch",
    available: true,
    permitted: true,
    onAction: vi.fn(),
    ...overrides,
  };
}

describe("visibleWorkflowActions", () => {
  it("shows an action the status allows and the caller may take", () => {
    expect(visibleWorkflowActions([action()])).toHaveLength(1);
  });

  it("hides an action the current status does not allow", () => {
    // "Dispatch" on an already-received transfer.
    expect(visibleWorkflowActions([action({ available: false })])).toEqual([]);
  });

  it("hides an action the caller lacks permission for", () => {
    // A stock keeper who may request a transfer but not approve one.
    expect(visibleWorkflowActions([action({ permitted: false })])).toEqual([]);
  });

  it("requires both: permission alone does not make an action available", () => {
    expect(visibleWorkflowActions([action({ available: false, permitted: true })])).toEqual([]);
    expect(visibleWorkflowActions([action({ available: true, permitted: false })])).toEqual([]);
  });

  it("keeps the caller's order, so the primary action stays first", () => {
    const result = visibleWorkflowActions([
      action({ key: "receive", label: "Receive" }),
      action({ key: "cancel", label: "Cancel" }),
    ]);
    expect(result.map((a) => a.key)).toEqual(["receive", "cancel"]);
  });

  it("filters a realistic mixed bar down to what is actually offered", () => {
    const result = visibleWorkflowActions([
      action({ key: "approve", available: false }),
      action({ key: "receive", available: true, permitted: true }),
      action({ key: "cancel", available: true, permitted: false }),
    ]);
    expect(result.map((a) => a.key)).toEqual(["receive"]);
  });
});

describe("isWorkflowIdle", () => {
  it("is true when nothing is offered, so the bar can render nothing", () => {
    expect(isWorkflowIdle([action({ available: false })])).toBe(true);
    expect(isWorkflowIdle([])).toBe(true);
  });

  it("is false as soon as one action is offered", () => {
    expect(isWorkflowIdle([action()])).toBe(false);
  });
});
