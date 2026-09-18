import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DataTable } from "./DataTable";
import type { DataTableColumn } from "./types";

type Row = { id: string; name: string; status: string };

const rows: Row[] = [
  { id: "1", name: "Flour", status: "active" },
  { id: "2", name: "Sugar", status: "draft" },
];

const columns: DataTableColumn<Row>[] = [
  { key: "name", header: "Name", render: (row) => row.name },
  { key: "status", header: "Status", render: (row) => row.status },
];

function setup(props: Partial<React.ComponentProps<typeof DataTable<Row>>> = {}) {
  return render(<DataTable columns={columns} rows={rows} rowKey={(row) => row.id} {...props} />);
}

describe("DataTable", () => {
  it("renders a row per record", () => {
    setup();
    expect(screen.getByText("Flour")).toBeInTheDocument();
    expect(screen.getByText("Sugar")).toBeInTheDocument();
  });

  it("shows the empty state rather than a bare table when there are no rows", () => {
    setup({ rows: [] });
    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
  });

  it("shows a skeleton while loading instead of the empty state", () => {
    setup({ rows: [], loading: true });
    expect(screen.queryByText("Nothing here yet")).not.toBeInTheDocument();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("surfaces the error message and a retry over the rows", async () => {
    const onRetry = vi.fn();
    setup({ error: { message: "Backend exploded" }, onRetry });

    expect(screen.getByText("Backend exploded")).toBeInTheDocument();
    expect(screen.queryByText("Flour")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("narrows visible rows with the client-side search box", async () => {
    setup({ search: { getText: (row) => row.name } });

    await userEvent.type(screen.getByRole("textbox", { name: "Search" }), "sug");

    expect(screen.queryByText("Flour")).not.toBeInTheDocument();
    expect(screen.getByText("Sugar")).toBeInTheDocument();
  });

  it("hands typing to the caller in serverSearch mode without filtering locally", async () => {
    const onChange = vi.fn();
    setup({ serverSearch: { value: "", onChange } });

    await userEvent.type(screen.getByRole("textbox", { name: "Search" }), "x");

    expect(onChange).toHaveBeenCalledWith("x");
    // Both rows stay: the backend, not the table, decides what matches.
    expect(screen.getByText("Flour")).toBeInTheDocument();
    expect(screen.getByText("Sugar")).toBeInTheDocument();
  });

  it("calls onRowClick with the clicked row", async () => {
    const onRowClick = vi.fn();
    setup({ onRowClick });

    await userEvent.click(screen.getByText("Sugar"));

    expect(onRowClick).toHaveBeenCalledWith(rows[1]);
  });

  it("keeps a selection keyed by row, so a filtered-out row stays selected", async () => {
    const bulkActions = vi.fn(() => <button type="button">Delete</button>);
    setup({ selectable: true, search: { getText: (row) => row.name }, bulkActions });

    const flourRow = screen.getByText("Flour").closest("tr")!;
    await userEvent.click(within(flourRow).getByRole("checkbox", { name: "Select row" }));
    expect(screen.getByText("1 selected")).toBeInTheDocument();

    // Filter Flour off-screen. Selection is keyed by rowKey, not by the
    // visible index, so it must survive the row leaving the viewport.
    await userEvent.type(screen.getByRole("textbox", { name: "Search" }), "sug");
    expect(screen.queryByText("Flour")).not.toBeInTheDocument();

    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(bulkActions).toHaveBeenLastCalledWith(
      expect.objectContaining({ keys: ["1"], rows: [rows[0]] }),
    );
  });

  it("loads more instead of offering page numbers, since cursors have none", async () => {
    const onLoadMore = vi.fn();
    setup({ hasMore: true, onLoadMore });

    expect(screen.queryByRole("button", { name: "2" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Load more" }));

    expect(onLoadMore).toHaveBeenCalledOnce();
  });
});
