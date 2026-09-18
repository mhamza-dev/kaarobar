import type { ReactNode } from "react";

export type DataTableColumn<T> = {
  key: string;
  header: ReactNode;
  /** Tailwind width utility, e.g. `w-32`. */
  width?: string;
  align?: "start" | "center" | "end";
  className?: string;
  render: (row: T) => ReactNode;
};

export type DataTableFilterOption = { value: string; label: string };

export type DataTableFilter<T> = {
  id: string;
  label: string;
  type: "select" | "boolean";
  options?: DataTableFilterOption[];
  /** Pulls the comparable value off a row. */
  getValue: (row: T) => string | boolean | null | undefined;
};

export type DataTableSearch<T> = {
  placeholder?: string;
  /** The text a row matches against. */
  getText: (row: T) => string;
};

export type DataTableFilterState = Record<string, string>;
