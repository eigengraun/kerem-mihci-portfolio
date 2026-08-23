import { Project } from "@/data/projects";
import { hashString, createSeededRandom } from "./desktopPlacement";

export interface ResolvedMobilePosition {
  projectId: string;
  x: number; // percentage (0 - 100)
  y: number; // percentage (0 - 100)
  weightScale: number;
}

// Mobile organic placement regions (optimized for portrait 375px - 430px viewports)
const MOBILE_PLACEMENT_REGIONS = [
  { minX: 18, maxX: 46, minY: 18, maxY: 34 }, // Top-Left region (below top floating controls)
  { minX: 54, maxX: 82, minY: 20, maxY: 36 }, // Top-Right region
  { minX: 18, maxX: 46, minY: 40, maxY: 52 }, // Mid-Left region
  { minX: 54, maxX: 82, minY: 42, maxY: 54 }, // Mid-Right region
  { minX: 20, maxX: 48, minY: 58, maxY: 68 }, // Lower-Left region (above two-row dock)
  { minX: 52, maxX: 80, minY: 58, maxY: 68 }  // Lower-Right region
];

/**
 * Checks if a candidate mobile location falls inside safe zones
 */
export function isMobileSafeZone(x: number, y: number): boolean {
  // 1. Top Floating Widgets Safe Zone (Workspace switcher & Settings button)
  if (y < 16) return false;

  // 2. Bottom Two-Row Dock Safe Zone
  if (y > 70) return false;

  // 3. Viewport Side Edge Margins
  if (x < 14 || x > 86) return false;

  return true;
}

/**
 * Resolves deterministic organic mobile spatial placements for a workspace.
 */
export function getResolvedMobilePlacements(
  projects: Project[],
  workspaceId: string
): Record<string, ResolvedMobilePosition> {
  const resolvedMap: Record<string, ResolvedMobilePosition> = {};
  const placedList: { id: string; x: number; y: number }[] = [];

  // Process mobile featured projects passed to placement engine
  const mobileProjects = projects;

  mobileProjects.forEach((project, idx) => {
    // 1. Manual Mobile Override
    if (project.desktopPlacement && project.desktopPlacement.x && project.desktopPlacement.y) {
      const pos = {
        projectId: project.id,
        x: project.desktopPlacement.x,
        y: project.desktopPlacement.y,
        weightScale: 1.0
      };
      resolvedMap[project.id] = pos;
      placedList.push({ id: project.id, x: pos.x, y: pos.y });
      return;
    }

    // 2. Seeded Random Generator for Mobile
    const seed = hashString(`${workspaceId}:${project.slug}:mobile`);
    const rng = createSeededRandom(seed);

    const regionIndex = idx % MOBILE_PLACEMENT_REGIONS.length;
    const region = MOBILE_PLACEMENT_REGIONS[regionIndex];

    let posX = region.minX + rng() * (region.maxX - region.minX);
    let posY = region.minY + rng() * (region.maxY - region.minY);

    // Ensure safe zones and clean separation
    if (!isMobileSafeZone(posX, posY)) {
      posX = Math.max(16, Math.min(84, posX));
      posY = Math.max(20, Math.min(74, posY));
    }

    // Collision avoidance
    placedList.forEach((placed) => {
      const dx = Math.abs(posX - placed.x);
      const dy = Math.abs(posY - placed.y);
      if (dx < 18 && dy < 16) {
        posX = (posX + 20) % 76 + 12;
        posY = (posY + 16) % 54 + 20;
      }
    });

    const pos = {
      projectId: project.id,
      x: Number(posX.toFixed(2)),
      y: Number(posY.toFixed(2)),
      weightScale: 1.0
    };

    resolvedMap[project.id] = pos;
    placedList.push({ id: project.id, x: pos.x, y: pos.y });
  });

  return resolvedMap;
}
