import { create } from "zustand";
import { getCascadingPosition, getMaximizedBounds } from "@/lib/windowUtils";
import { useDesktopStore } from "./desktopStore";

export type WindowType =
  | "project"
  | "about"
  | "cv"
  | "gallery"
  | "video"
  | "projects"
  | "contact"
  | "alert"
  | "image-viewer"
  | "tool-info"
  | "notes"
  | "trash";

export interface WindowInstance {
  id: string;
  workspaceId: "design" | "web" | "motion-ai";
  contentId: string;
  type: WindowType;
  titleTR: string;
  titleEN: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  minimized: boolean;
  maximized: boolean;
  previousBounds?: { x: number; y: number; width: number; height: number };
  scrollTop?: number;
  extraData?: Record<string, unknown>;
}

export interface OpenWindowOptions {
  id: string;
  workspaceId?: "design" | "web" | "motion-ai";
  contentId?: string;
  type: WindowType;
  titleTR: string;
  titleEN: string;
  width?: number;
  height?: number;
  preferredWidth?: number;
  preferredHeight?: number;
  extraData?: Record<string, unknown>;
}


interface WindowStoreState {
  windows: Record<string, WindowInstance[]>; // workspaceId -> array of windows
  highestZIndex: number;

  openWindow: (options: OpenWindowOptions) => void;
  closeWindow: (id: string, workspaceId: string) => void;
  minimizeWindow: (id: string, workspaceId: string) => void;
  maximizeWindow: (id: string, workspaceId: string, viewportWidth: number, viewportHeight: number) => void;
  bringToFront: (id: string, workspaceId: string) => void;
  updateWindowBounds: (id: string, workspaceId: string, bounds: { x: number; y: number; width: number; height: number }) => void;
  updateWindowScroll: (id: string, workspaceId: string, scrollTop: number) => void;
  initFromStorage: () => void;
}

const STORAGE_KEY = "portfolioWindowStore_v2";

function loadSavedWindows(): { windows: Record<string, WindowInstance[]>; highestZ: number } {
  const empty = { windows: { design: [], web: [], "motion-ai": [] }, highestZ: 100 };
  if (typeof window === "undefined") {
    return empty;
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && parsed.windows && typeof parsed.windows === "object") {
        const filterTransient = (list: unknown) =>
          Array.isArray(list) ? (list.filter((w) => w && typeof w === "object" && (w as WindowInstance).type !== "alert") as WindowInstance[]) : [];
        return {
          windows: {
            design: filterTransient(parsed.windows.design),
            web: filterTransient(parsed.windows.web),
            "motion-ai": filterTransient(parsed.windows["motion-ai"])
          },
          highestZ: typeof parsed.highestZIndex === "number" ? parsed.highestZIndex : 100
        };
      }
    }
  } catch {
    // fallback
  }
  return empty;
}

function saveWindows(windows: Record<string, WindowInstance[]>, highestZIndex: number) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ windows, highestZIndex }));
  } catch {
    // ignore
  }
}

export const useWindowStore = create<WindowStoreState>((set, get) => ({
  windows: { design: [], web: [], "motion-ai": [] },
  highestZIndex: 100,

  initFromStorage: () => {
    const saved = loadSavedWindows();
    set({ windows: saved.windows, highestZIndex: saved.highestZ });
  },

  openWindow: (options) => {
    const { windows, highestZIndex } = get();
    const activeWs = useDesktopStore.getState().activeWorkspace;
    const workspaceId = options.workspaceId || activeWs;
    const currentWorkspaceWindows = windows[workspaceId] || [];

    // Check if an instance with exact same ID already exists
    const existing = currentWorkspaceWindows.find((w) => w.id === options.id);
    const newZ = highestZIndex + 1;

    if (existing) {
      // Bring existing to front and restore if minimized
      const updatedList = currentWorkspaceWindows.map((w) => {
        if (w.id === options.id) {
          return {
            ...w,
            minimized: false,
            zIndex: newZ
          };
        }
        return w;
      });

      const nextWindows = { ...windows, [workspaceId]: updatedList };
      saveWindows(nextWindows, newZ);
      set({ windows: nextWindows, highestZIndex: newZ });
      return;
    }

    // Default window dimensions based on application type
    const prefW = options.width || options.preferredWidth;
    const prefH = options.height || options.preferredHeight;

    let defaultW = prefW || 580;
    let defaultH = prefH || 460;

    if (!prefW) {
      if (options.type === "tool-info") { defaultW = 400; defaultH = 175; }
      else if (options.type === "alert") { defaultW = 380; defaultH = 170; }
      else if (options.type === "project") { defaultW = 720; defaultH = 560; }
      else if (options.type === "about") { defaultW = 780; defaultH = 540; }
      else if (options.type === "projects") { defaultW = 860; defaultH = 580; }
      else if (options.type === "gallery") { defaultW = 740; defaultH = 560; }
      else if (options.type === "video") { defaultW = 510; defaultH = 660; }
      else if (options.type === "contact") { defaultW = 680; defaultH = 460; }
      else if (options.type === "cv") { defaultW = 680; defaultH = 540; }
      else if (options.type === "notes") { defaultW = 760; defaultH = 580; }
      else if (options.type === "trash") { defaultW = 560; defaultH = 420; }
      else if (options.type === "image-viewer") { defaultW = 760; defaultH = 560; }
    }

    const viewportW = typeof window !== "undefined" ? window.innerWidth : 1280;
    const viewportH = typeof window !== "undefined" ? window.innerHeight : 800;

    const pos = getCascadingPosition(currentWorkspaceWindows.length, defaultW, defaultH, viewportW, viewportH);

    const newWin: WindowInstance = {
      id: options.id,
      workspaceId,
      contentId: options.contentId || options.id,
      type: options.type,
      titleTR: options.titleTR,
      titleEN: options.titleEN,
      x: pos.x,
      y: pos.y,
      width: pos.width,
      height: pos.height,
      zIndex: newZ,
      minimized: false,
      maximized: false,
      extraData: options.extraData
    };

    const nextWindows = {
      ...windows,
      [workspaceId]: [...currentWorkspaceWindows, newWin]
    };

    saveWindows(nextWindows, newZ);
    set({ windows: nextWindows, highestZIndex: newZ });
  },

  closeWindow: (id, workspaceId) => {
    const { windows, highestZIndex } = get();
    const currentList = windows[workspaceId] || [];
    const nextList = currentList.filter((w) => w.id !== id);
    const nextWindows = { ...windows, [workspaceId]: nextList };
    saveWindows(nextWindows, highestZIndex);
    set({ windows: nextWindows });
  },

  minimizeWindow: (id, workspaceId) => {
    const { windows, highestZIndex } = get();
    const currentList = windows[workspaceId] || [];
    const nextList = currentList.map((w) =>
      w.id === id ? { ...w, minimized: true } : w
    );
    const nextWindows = { ...windows, [workspaceId]: nextList };
    saveWindows(nextWindows, highestZIndex);
    set({ windows: nextWindows });
  },

  maximizeWindow: (id, workspaceId, viewportWidth, viewportHeight) => {
    const { windows, highestZIndex } = get();
    const currentList = windows[workspaceId] || [];
    const newZ = highestZIndex + 1;

    const nextList = currentList.map((w) => {
      if (w.id === id) {
        if (w.maximized) {
          // Restore
          const prev = w.previousBounds || { x: 100, y: 100, width: 600, height: 450 };
          return {
            ...w,
            maximized: false,
            x: prev.x,
            y: prev.y,
            width: prev.width,
            height: prev.height,
            zIndex: newZ
          };
        } else {
          // Maximize
          const maxBounds = getMaximizedBounds(viewportWidth, viewportHeight);
          return {
            ...w,
            maximized: true,
            previousBounds: { x: w.x, y: w.y, width: w.width, height: w.height },
            x: maxBounds.x,
            y: maxBounds.y,
            width: maxBounds.width,
            height: maxBounds.height,
            zIndex: newZ
          };
        }
      }
      return w;
    });

    const nextWindows = { ...windows, [workspaceId]: nextList };
    saveWindows(nextWindows, newZ);
    set({ windows: nextWindows, highestZIndex: newZ });
  },

  bringToFront: (id, workspaceId) => {
    const { windows, highestZIndex } = get();
    const currentList = windows[workspaceId] || [];
    const target = currentList.find((w) => w.id === id);
    if (!target || target.zIndex === highestZIndex) return;

    const newZ = highestZIndex + 1;
    const nextList = currentList.map((w) =>
      w.id === id ? { ...w, zIndex: newZ, minimized: false } : w
    );

    const nextWindows = { ...windows, [workspaceId]: nextList };
    saveWindows(nextWindows, newZ);
    set({ windows: nextWindows, highestZIndex: newZ });
  },

  updateWindowBounds: (id, workspaceId, bounds) => {
    const { windows, highestZIndex } = get();
    const currentList = windows[workspaceId] || [];
    const nextList = currentList.map((w) =>
      w.id === id
        ? {
            ...w,
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
            maximized: false // reset max if dragged/resized
          }
        : w
    );

    const nextWindows = { ...windows, [workspaceId]: nextList };
    saveWindows(nextWindows, highestZIndex);
    set({ windows: nextWindows });
  },

  updateWindowScroll: (id, workspaceId, scrollTop) => {
    const { windows, highestZIndex } = get();
    const currentList = windows[workspaceId] || [];
    const nextList = currentList.map((w) =>
      w.id === id ? { ...w, scrollTop } : w
    );
    const nextWindows = { ...windows, [workspaceId]: nextList };
    saveWindows(nextWindows, highestZIndex);
    set({ windows: nextWindows });
  }
}));
