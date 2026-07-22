"use client";

import {
  useCallback,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import InfoButton from "@/components/ui/InfoButton";

export type TabItem<T extends string = string> = {
  id: T;
  label: string;
  /** Optional count / badge shown beside the label */
  badge?: string | number;
  disabled?: boolean;
  icon?: ReactNode;
  /** Help topic id — shows (i) beside the tab */
  infoKey?: string;
};

export type TabsProps<T extends string = string> = {
  tabs: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** `underline` = page section tabs (default). `pills` = compact segmented control. */
  variant?: "underline" | "pills";
  /** Accessible name for the tablist */
  "aria-label"?: string;
  className?: string;
  size?: "sm" | "md";
};

/**
 * Semantic tablist for page / section navigation.
 * Keyboard: ArrowLeft/Right, Home, End.
 */
export default function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  variant = "underline",
  "aria-label": ariaLabel = "Sections",
  className = "",
  size = "md",
}: TabsProps<T>) {
  const listId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const enabled = tabs.filter((t) => !t.disabled);
  const activeIndex = Math.max(
    0,
    enabled.findIndex((t) => t.id === value)
  );

  const focusTab = useCallback((index: number) => {
    const el = refs.current[index];
    el?.focus();
  }, []);

  const selectByEnabledIndex = useCallback(
    (enabledIndex: number) => {
      const tab = enabled[enabledIndex];
      if (!tab) return;
      onChange(tab.id);
      const fullIndex = tabs.findIndex((t) => t.id === tab.id);
      focusTab(fullIndex);
    },
    [enabled, focusTab, onChange, tabs]
  );

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!enabled.length) return;

    let next = activeIndex;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      next = (activeIndex + 1) % enabled.length;
      selectByEnabledIndex(next);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      next = (activeIndex - 1 + enabled.length) % enabled.length;
      selectByEnabledIndex(next);
    } else if (e.key === "Home") {
      e.preventDefault();
      selectByEnabledIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      selectByEnabledIndex(enabled.length - 1);
    }
  }

  const pad = size === "sm" ? "px-3 py-2 text-xs" : "px-3.5 py-2.5 text-sm";

  if (variant === "pills") {
    return (
      <div
        role="tablist"
        aria-label={ariaLabel}
        id={listId}
        onKeyDown={onKeyDown}
        className={`inline-flex max-w-full flex-wrap gap-1 rounded-lg border border-border/80 bg-bg-tertiary/80 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] ${className}`}
      >
        {tabs.map((tab, index) => {
          const selected = value === tab.id;
          return (
            <div key={tab.id} className="inline-flex items-center gap-0.5">
              <button
                ref={(el) => {
                  refs.current[index] = el;
                }}
                type="button"
                role="tab"
                id={`${listId}-${tab.id}`}
                aria-selected={selected}
                aria-controls={`${listId}-panel-${tab.id}`}
                tabIndex={selected ? 0 : -1}
                disabled={tab.disabled}
                onClick={() => onChange(tab.id)}
                className={`
                inline-flex items-center gap-2 rounded-md ${pad} font-semibold
                transition duration-150 ease-out
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-1
                disabled:cursor-not-allowed disabled:opacity-40
                ${
                  selected
                    ? "bg-card text-heading shadow-sm ring-1 ring-black/5"
                    : "text-body hover:bg-card/60 hover:text-heading"
                }
              `}
              >
                {tab.icon ? <span className="opacity-80">{tab.icon}</span> : null}
                <span>{tab.label}</span>
                {tab.badge != null && tab.badge !== "" ? (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                      selected ? "bg-brand-soft text-brand" : "bg-bg-secondary text-muted"
                    }`}
                  >
                    {tab.badge}
                  </span>
                ) : null}
              </button>
              {tab.infoKey ? (
                <InfoButton topicId={tab.infoKey} className="me-0.5" />
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      id={listId}
      onKeyDown={onKeyDown}
      className={`relative flex max-w-full gap-0 overflow-x-auto border-b border-border [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      {tabs.map((tab, index) => {
        const selected = value === tab.id;
        return (
          <div key={tab.id} className="relative inline-flex shrink-0 items-center">
            <button
              ref={(el) => {
                refs.current[index] = el;
              }}
              type="button"
              role="tab"
              id={`${listId}-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${listId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              disabled={tab.disabled}
              onClick={() => onChange(tab.id)}
              className={`
              relative shrink-0 inline-flex items-center gap-2 ${pad} font-semibold
              transition-colors duration-150
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35 focus-visible:ring-inset
              disabled:cursor-not-allowed disabled:opacity-40
              ${selected ? "text-heading" : "text-muted hover:text-heading"}
            `}
            >
              {tab.icon ? <span className="opacity-80">{tab.icon}</span> : null}
              <span>{tab.label}</span>
              {tab.badge != null && tab.badge !== "" ? (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                    selected ? "bg-brand-soft text-brand" : "bg-bg-tertiary text-muted"
                  }`}
                >
                  {tab.badge}
                </span>
              ) : null}
              <span
                aria-hidden
                className={`absolute inset-x-2 bottom-0 h-0.5 rounded-full transition-all duration-200 ${
                  selected ? "bg-brand opacity-100" : "bg-transparent opacity-0"
                }`}
              />
            </button>
            {tab.infoKey ? (
              <InfoButton topicId={tab.infoKey} className="-ms-1 me-1" />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** Optional panel wrapper for aria-controls pairing. */
export function TabPanel({
  id,
  tabId,
  active,
  children,
  className = "",
}: {
  id: string;
  tabId: string;
  active: boolean;
  children: ReactNode;
  className?: string;
}) {
  if (!active) return null;
  return (
    <div
      role="tabpanel"
      id={`${id}-panel-${tabId}`}
      aria-labelledby={`${id}-${tabId}`}
      className={className}
    >
      {children}
    </div>
  );
}
