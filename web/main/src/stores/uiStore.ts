import { create } from "zustand";

const UI_PREFS_KEY = "kb_ui_prefs";

type UiPrefs = {
  sidebarCollapsed: boolean;
  /** Labels of the sidebar groups folded shut. */
  collapsedNavGroups: string[];
};

/**
 * How this browser last left the sidebar. Per-browser convenience only —
 * storage can be missing (private mode, blocked) and then the sidebar just
 * opens fully expanded.
 */
function readPrefs(): UiPrefs {
  const defaults: UiPrefs = { sidebarCollapsed: false, collapsedNavGroups: [] };
  if (typeof window === "undefined") return defaults;
  try {
    const stored = JSON.parse(localStorage.getItem(UI_PREFS_KEY) ?? "{}");
    return {
      sidebarCollapsed: stored.sidebarCollapsed === true,
      collapsedNavGroups: Array.isArray(stored.collapsedNavGroups)
        ? stored.collapsedNavGroups.filter((label: unknown) => typeof label === "string")
        : [],
    };
  } catch {
    return defaults;
  }
}

function writePrefs(prefs: UiPrefs) {
  try {
    localStorage.setItem(UI_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Storage unavailable — the choice lasts until the tab closes.
  }
}

type UiState = UiPrefs & {
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleNavGroup: (label: string) => void;
};

export const useUiStore = create<UiState>((set, get) => {
  const save = () =>
    writePrefs({
      sidebarCollapsed: get().sidebarCollapsed,
      collapsedNavGroups: get().collapsedNavGroups,
    });

  return {
    ...readPrefs(),
    toggleSidebar: () => {
      set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
      save();
    },
    setSidebarCollapsed: (collapsed) => {
      set({ sidebarCollapsed: collapsed });
      save();
    },
    toggleNavGroup: (label) => {
      set((state) => ({
        collapsedNavGroups: state.collapsedNavGroups.includes(label)
          ? state.collapsedNavGroups.filter((existing) => existing !== label)
          : [...state.collapsedNavGroups, label],
      }));
      save();
    },
  };
});
