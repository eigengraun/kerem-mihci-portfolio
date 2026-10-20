"use client";

import { create } from "zustand";
import { projectsData, Project } from "@/data/projects";
import { videosData, PortfolioVideo } from "@/data/videos";
import { galleryItems, GalleryItem } from "@/data/gallery";
import { getResolvedDesktopPlacements, ResolvedDesktopPosition } from "@/lib/desktopPlacement";
import { workspacesData } from "@/data/workspaces";

/**
 * Deterministic PRNG based on Mulberry32
 */
function createMulberry32(seed: number) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates array shuffle utility
 */
export function shuffleArray<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

// Generate single session seed in memory (created once on initial module execution)
const sessionSeed =
  typeof window !== "undefined" ? Math.floor(Math.random() * 1000000) + 1 : 54321;

function computeWorkspacePlacements(
  projects: readonly Project[],
  seed: number,
  manualOverrides: Record<string, Record<string, ResolvedDesktopPosition>> = {}
): Record<string, Record<string, ResolvedDesktopPosition>> {
  const placements: Record<string, Record<string, ResolvedDesktopPosition>> = {};
  workspacesData.forEach((ws) => {
    const featured = projects.filter(
      (p) => p.featured === true && (p.workspaceId || p.workspace) === ws.id
    );
    const resolved = getResolvedDesktopPlacements(featured, ws.id, seed);
    const wsManual = manualOverrides[ws.id] || {};
    placements[ws.id] = {
      ...resolved,
      ...wsManual
    };
  });
  return placements;
}

const initialProjects = shuffleArray(projectsData, createMulberry32(sessionSeed));
const initialVideos = shuffleArray(videosData, createMulberry32(sessionSeed + 1));
const initialGallery = shuffleArray(galleryItems, createMulberry32(sessionSeed + 2));
const initialPlacements = computeWorkspacePlacements(projectsData, sessionSeed);

export interface SessionStoreState {
  sessionSeed: number;
  rawProjects: Project[];
  sessionProjects: Project[];
  sessionVideos: PortfolioVideo[];
  sessionGallery: GalleryItem[];
  desktopPlacements: Record<string, Record<string, ResolvedDesktopPosition>>;
  manualPlacements: Record<string, Record<string, ResolvedDesktopPosition>>;
  isDraggingProject: boolean;
  setIsDraggingProject: (isDragging: boolean) => void;
  hydrateProjects: (projects: Project[]) => void;
  hydrateVideos: (videos: PortfolioVideo[], isCmsMode?: boolean) => void;
  updateDesktopPosition: (workspaceId: string, projectId: string, pos: { x: number; y: number }) => void;
}

export const useSessionStore = create<SessionStoreState>((set) => ({
  sessionSeed,
  rawProjects: projectsData,
  sessionProjects: initialProjects,
  sessionVideos: initialVideos,
  sessionGallery: initialGallery,
  desktopPlacements: initialPlacements,
  manualPlacements: {},
  isDraggingProject: false,
  setIsDraggingProject: (isDraggingProject: boolean) => set({ isDraggingProject }),
  hydrateProjects: (projects: Project[]) => {
    if (!Array.isArray(projects) || projects.length === 0) return;
    set((state) => {
      const prng = createMulberry32(state.sessionSeed);
      const shuffled = shuffleArray(projects, prng);
      const placements = computeWorkspacePlacements(
        projects,
        state.sessionSeed,
        state.manualPlacements
      );
      return {
        rawProjects: projects,
        sessionProjects: shuffled,
        desktopPlacements: placements
      };
    });
  },
  hydrateVideos: (videos: PortfolioVideo[], isCmsMode = false) => {
    if (!Array.isArray(videos)) return;
    set((state) => {
      // In CMS mode, respect explicit sortOrder ASC and allow clearing to empty array.
      // In legacy mode, preserve seeded PRNG shuffle.
      if (isCmsMode) {
        const resolvedVideos = [...videos].sort(
          (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
        );
        return {
          sessionVideos: resolvedVideos
        };
      }
      if (videos.length === 0) return state;
      return {
        sessionVideos: shuffleArray(videos, createMulberry32(state.sessionSeed + 1))
      };
    });
  },
  updateDesktopPosition: (workspaceId: string, projectId: string, pos: { x: number; y: number }) => {
    set((state) => {
      const currentWs = state.desktopPlacements[workspaceId] || {};
      const currentPos = currentWs[projectId];
      if (!currentPos) return state;

      const zIndexOffset = 10 + Math.floor(pos.y / 2);
      const updatedPos: ResolvedDesktopPosition = {
        ...currentPos,
        x: pos.x,
        y: pos.y,
        zIndexOffset
      };

      const currentManualWs = state.manualPlacements[workspaceId] || {};

      return {
        desktopPlacements: {
          ...state.desktopPlacements,
          [workspaceId]: {
            ...currentWs,
            [projectId]: updatedPos
          }
        },
        manualPlacements: {
          ...state.manualPlacements,
          [workspaceId]: {
            ...currentManualWs,
            [projectId]: updatedPos
          }
        }
      };
    });
  }
}));
