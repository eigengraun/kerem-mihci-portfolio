import { create } from "zustand";
import { Locale } from "@/data/translations";

export type WorkspaceId = "design" | "web" | "motion-ai";
export type ThemeMode = "light" | "dark";

interface DesktopState {
  activeWorkspace: WorkspaceId;
  selectedIconId: string | null;
  locale: Locale;
  theme: ThemeMode;
  portfolioHintSeen: boolean;
  
  setActiveWorkspace: (id: WorkspaceId) => void;
  setSelectedIconId: (id: string | null) => void;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  dismissHint: () => void;
  initFromStorage: () => void;
}

const THEME_STORAGE_KEY = "portfolioThemeMode";

export const useDesktopStore = create<DesktopState>((set, get) => ({
  activeWorkspace: "design",
  selectedIconId: null,
  locale: "tr",
  theme: "dark",
  portfolioHintSeen: false, // Default in-memory state on every page load

  initFromStorage: () => {
    if (typeof window === "undefined") return;
    try {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      const theme: ThemeMode = savedTheme === "light" || savedTheme === "dark" ? savedTheme : "dark";
      set({ portfolioHintSeen: false, theme });
    } catch {
      // fallback
    }
  },

  setActiveWorkspace: (id) =>
    set({
      activeWorkspace: id,
      selectedIconId: null // deselect icon on workspace change
    }),

  setSelectedIconId: (id) => set({ selectedIconId: id }),

  setLocale: (locale) => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
    set({ locale });
  },

  setTheme: (theme) => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
      } catch {
        // ignore
      }
    }
    set({ theme });
  },

  toggleTheme: () => {
    const current = get().theme;
    const nextTheme = current === "light" ? "dark" : "light";
    get().setTheme(nextTheme);
  },

  dismissHint: () => {
    // In-memory dismissal only (resets on full page refresh)
    set({ portfolioHintSeen: true });
  }
}));
