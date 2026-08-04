"use client";

import type { ComponentProps, ReactNode } from "react";
import { PageHeader, TabBar } from "@/components/app/ui";

type PageHeaderProps = ComponentProps<typeof PageHeader>;
type TabBarProps = ComponentProps<typeof TabBar>;

type WorkspacePageScaffoldProps<TTab extends string = string> = {
  header: PageHeaderProps;
  tabs?: Omit<Pick<TabBarProps, "tabs">, "tabs"> & {
    tabs: { id: TTab; label: string; infoKey?: string }[];
    value: TTab;
    onChange: (next: TTab) => void;
    ariaLabel?: string;
  };
  children: ReactNode;
};

export default function WorkspacePageScaffold<TTab extends string = string>({
  header,
  tabs,
  children,
}: WorkspacePageScaffoldProps<TTab>) {
  return (
    <div className="space-y-6">
      <PageHeader {...header} />
      {tabs ? (
        <TabBar
          tabs={tabs.tabs}
          value={tabs.value}
          onChange={(next) => tabs.onChange(next as TTab)}
          aria-label={tabs.ariaLabel}
        />
      ) : null}
      {children}
    </div>
  );
}
