import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DescriptionList } from "./DescriptionList";
import { DetailSheet } from "./DetailSheet";

describe("DetailSheet", () => {
  it("is a labelled dialog showing the record", () => {
    render(
      <DetailSheet open onOpenChange={() => {}} title="Al-Madina Wholesale">
        <DescriptionList items={[{ label: "City", value: "Lahore" }]} />
      </DetailSheet>,
    );
    expect(screen.getByRole("dialog", { name: "Al-Madina Wholesale" })).toBeInTheDocument();
    expect(screen.getByText("Lahore")).toBeInTheDocument();
  });

  it("shows a skeleton, not the body, while loading", () => {
    render(
      <DetailSheet open onOpenChange={() => {}} loading>
        <p>Body</p>
      </DetailSheet>,
    );
    expect(screen.getByRole("dialog", { name: "Loading…" })).toBeInTheDocument();
    expect(screen.queryByText("Body")).not.toBeInTheDocument();
  });

  it("offers a retry when the record failed to load", async () => {
    const onRetry = vi.fn();
    render(
      <DetailSheet
        open
        onOpenChange={() => {}}
        error={new Error("boom")}
        onRetry={onRetry}
        what="this supplier"
        actions={<button>Archive</button>}
      >
        <p>Body</p>
      </DetailSheet>,
    );
    expect(screen.getByText("Couldn't load this supplier.")).toBeInTheDocument();
    // No acting on a record that isn't there.
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("closes on Escape", async () => {
    const onOpenChange = vi.fn();
    render(
      <DetailSheet open onOpenChange={onOpenChange} title="Batch B-12">
        <p>Body</p>
      </DetailSheet>,
    );
    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
  });
});

describe("DescriptionList", () => {
  it("marks a missing value instead of leaving a gap, and drops hidden fields", () => {
    render(
      <DescriptionList
        items={[
          { label: "Phone", value: null },
          { label: "Secret", value: "x", hidden: true },
        ]}
      />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("Secret")).not.toBeInTheDocument();
  });
});
