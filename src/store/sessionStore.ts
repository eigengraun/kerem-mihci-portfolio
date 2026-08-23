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
const sessionSeed = typeof window !== "undefined"
  ? Math.floor(Math.random() * 1000000) + 1
  : 54321;

const sessionPrng = createMulberry32(sessionSeed);

// Generate single session shuffled arrays
const initialProjects = shuffleArray(projectsData, sessionPrng);
const initialVideos = shuffleArray(videosData, sessionPrng);
const initialGallery = shuffleArray(galleryItems, sessionPrng);

// Calculate initial organic desktop placements for each workspace
const initialPlacements: Record<string, Record<string, ResolvedDesktopPosition>> = {};
workspacesData.forEach((ws) => {
  const featured = projectsData.filter(
    (p) => p.featured === true && ((p.workspaceId || p.workspace) === ws.id)
  );
  initialPlacements[ws.id] = getResolvedDesktopPlacements(featured, ws.id, sessionSeed);
});

export interface SessionStoreState {
  sessionSeed: number;
  sessionProjects: Project[];
  sessionVideos: PortfolioVideo[];
  sessionGallery: GalleryItem[];
  desktopPlacements: Record<string, Record<string, ResolvedDesktopPosition>>;
  isDraggingProject: boolean;
  setIsDraggingProject: (isDragging: boolean) => void;
  updateDesktopPosition: (workspaceId: string, projectId: string, pos: { x: number; y: number }) => void;
}

export const useSessionStore = create<SessionStoreState>((set) => ({
  sessionSeed,
  sessionProjects: initialProjects,
  sessionVideos: initialVideos,
  sessionGallery: initialGallery,
  desktopPlacements: initialPlacements,
  isDraggingProject: false,
  setIsDraggingProject: (isDraggingProject: boolean) => set({ isDraggingProject }),
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

      return {
        desktopPlacements: {
          ...state.desktopPlacements,
          [workspaceId]: {
            ...currentWs,
            [projectId]: updatedPos
          }
        }
      };
    });
  }
}));
