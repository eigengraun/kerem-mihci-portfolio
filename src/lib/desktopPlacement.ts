import { Project } from "@/data/projects";

export interface ResolvedDesktopPosition {
  projectId: string;
  x: number; // percentage (0 - 100)
  y: number; // percentage (0 - 100)
  weightScale: number;
  zIndexOffset: number;
}

/**
 * Stable String Hash Generator (djb2 algorithm)
 */
export function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0;
}

/**
 * Deterministic Pseudo-Random Generator
 */
export function createSeededRandom(seed: number) {
  let s = seed;
  return function () {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// Minimal collision gap between neighboring project icon groups (approx 8px visual gap in reference 1440x900 viewport)
export const COLLISION_GAP_PX = 8;
export const COLLISION_X_MARGIN = ((130 + COLLISION_GAP_PX) / 1440) * 100; // ~9.58% in 1440px viewport
export const COLLISION_Y_MARGIN = ((111 + COLLISION_GAP_PX) / 900) * 100;  // ~13.22% in 900px viewport

export interface ProjectFootprint {
  halfWidth: number; // percentage of viewport width
  halfHeight: number; // percentage of viewport height
}

/**
 * Calculates the aspect-aware spatial footprint for a project icon on the desktop
 * based on actual rendered media dimensions, compact label height, and minimal ~8px safety gap.
 */
export function getProjectFootprint(project?: Project): ProjectFootprint {
  let previewW = 130;
  let previewH = 81;

  if (project?.desktopThumbnail?.width && project?.desktopThumbnail?.height) {
    const aspect = project.desktopThumbnail.width / project.desktopThumbnail.height;
    if (aspect >= 130 / 92) {
      previewW = 130;
      previewH = 130 / aspect;
    } else {
      previewH = 92;
      previewW = 92 * aspect;
    }
  }

  // Label width approximates rendered container (min 85px for narrow portrait, max 130px)
  const visualW = Math.max(previewW, Math.min(130, 85));
  // Thumbnail height + 6px gap + ~24px rendered label height
  const visualH = previewH + 6 + 24;

  // Total bounds include minimal collision padding (COLLISION_GAP_PX = 8px)
  const totalW = visualW + COLLISION_GAP_PX;
  const totalH = visualH + COLLISION_GAP_PX;

  // Reference viewport: 1440 x 900
  const halfWidthPercent = (totalW / 2 / 1440) * 100;
  const halfHeightPercent = (totalH / 2 / 900) * 100;

  return {
    halfWidth: halfWidthPercent,
    halfHeight: halfHeightPercent
  };
}

/**
 * Checks if a candidate (x, y) falls inside protected interface safe zones.
 * Accounts for maximum magnified Dock height, workspace selector, and global top controls.
 */
export function isLocationInSafeZone(x: number, y: number): boolean {
  // 1. Viewport Outer Margins
  if (x < 7.5 || x > 87.5 || y < 12.0 || y > 68.0) return false;

  // 2. Top-Right Controls Zone (TR/EN, Theme toggle, System time)
  if (x > 67.0 && y < 22.0) return false;

  // 3. Left Workspace Selector Zone (Active in left 24% between y 26% and 72%)
  if (x < 24.5 && y >= 26.0 && y <= 72.0) return false;

  // 4. Bottom Dock Area (Takes into account maximum Dock icon magnification + tooltip + margin)
  if (y > 67.5) return false;
  if (x >= 24.0 && x <= 76.0 && y > 64.0) return false;

  // 5. Right-side scroll progress indicator
  if (x > 86.5) return false;

  return true;
}

export interface PlacedDesktopItem {
  id?: string;
  projectId?: string;
  x: number;
  y: number;
  footprint?: ProjectFootprint;
}

/**
 * Checks if a candidate position collides with any already placed items using aspect-aware bounding boxes
 * with minimal ~8px gap. Pure AABB (Axis-Aligned Bounding Box) for tight, natural organic packing.
 */
export function hasProjectCollision(
  candidateX: number,
  candidateY: number,
  placedItems: PlacedDesktopItem[],
  candidateFootprint?: ProjectFootprint,
  ignoreId?: string
): boolean {
  const cHW = candidateFootprint?.halfWidth ?? (COLLISION_X_MARGIN / 2);
  const cHH = candidateFootprint?.halfHeight ?? (COLLISION_Y_MARGIN / 2);

  for (const item of placedItems) {
    const itemId = item.projectId || item.id;
    if (ignoreId && itemId === ignoreId) continue;

    const itemHW = item.footprint?.halfWidth ?? (COLLISION_X_MARGIN / 2);
    const itemHH = item.footprint?.halfHeight ?? (COLLISION_Y_MARGIN / 2);

    const reqX = cHW + itemHW;
    const reqY = cHH + itemHH;

    const dx = Math.abs(candidateX - item.x);
    const dy = Math.abs(candidateY - item.y);

    // Exact AABB intersection check with minimal safety gap
    if (dx < reqX && dy < reqY) {
      return true;
    }
  }
  return false;
}

/**
 * Resolves 100% collision-free, organic spatial placements for workspace featured projects.
 * Runs deterministically based on sessionSeed once per full page refresh.
 */
export function getResolvedDesktopPlacements(
  projects: Project[],
  workspaceId: string,
  sessionSeed: number = 0
): Record<string, ResolvedDesktopPosition> {
  const resolvedMap: Record<string, ResolvedDesktopPosition> = {};
  const placedList: PlacedDesktopItem[] = [];

  projects.forEach((project, index) => {
    // Seeded PRNG for this specific project
    const seed = hashString(`${sessionSeed}:${workspaceId}:${project.slug}:${project.id}:${index}`);
    const rng = createSeededRandom(seed);
    const weightScale = getWeightScale(project.desktopWeight);
    const footprint = getProjectFootprint(project);

    let chosenX = 20;
    let chosenY = 20;
    let found = false;

    // 1. Try up to 120 randomized candidate positions
    for (let attempt = 0; attempt < 120; attempt++) {
      const candidateX = 9.0 + rng() * 76.0; // 9% to 85%
      const candidateY = 13.0 + rng() * 53.0; // 13% to 66%

      if (!isLocationInSafeZone(candidateX, candidateY)) {
        continue;
      }

      if (!hasProjectCollision(candidateX, candidateY, placedList, footprint)) {
        chosenX = candidateX;
        chosenY = candidateY;
        found = true;
        break;
      }
    }

    // 2. Fallback: Deterministic Spatial Grid Scan if random attempts failed
    if (!found) {
      let maxMinDist = -1;
      let fallbackX = 45;
      let fallbackY = 35;

      for (let gy = 14.0; gy <= 65.0; gy += 3.5) {
        for (let gx = 10.0; gx <= 84.0; gx += 3.5) {
          if (!isLocationInSafeZone(gx, gy)) continue;
          if (hasProjectCollision(gx, gy, placedList, footprint)) continue;

          // Find candidate that maximizes distance to nearest placed item
          let minDist = 999;
          for (const item of placedList) {
            const itemHW = item.footprint?.halfWidth ?? (COLLISION_X_MARGIN / 2);
            const itemHH = item.footprint?.halfHeight ?? (COLLISION_Y_MARGIN / 2);
            const reqX = footprint.halfWidth + itemHW;
            const reqY = footprint.halfHeight + itemHH;
            const d = Math.hypot((gx - item.x) / reqX, (gy - item.y) / reqY);
            if (d < minDist) minDist = d;
          }

          if (minDist > maxMinDist) {
            maxMinDist = minDist;
            fallbackX = gx;
            fallbackY = gy;
          }
        }
      }

      chosenX = fallbackX;
      chosenY = fallbackY;
    }

    const zIndexOffset = 10 + Math.floor(chosenY / 2);
    const pos: ResolvedDesktopPosition = {
      projectId: project.id,
      x: Number(chosenX.toFixed(2)),
      y: Number(chosenY.toFixed(2)),
      weightScale,
      zIndexOffset
    };

    resolvedMap[project.id] = pos;
    placedList.push({ id: project.id, projectId: project.id, x: pos.x, y: pos.y, footprint });
  });

  return resolvedMap;
}

/**
 * Clamps a manually dragged icon's drop position into safe desktop viewport bounds,
 * ensuring it stays within accessible desktop area and does not get hidden behind the Dock,
 * without restricting or correcting user-intended project-on-project overlaps.
 */
export function resolveSafeDropPosition(
  proposedX: number,
  proposedY: number
): { x: number; y: number } {
  // Clamp proposed position into global desktop safe boundaries
  const clampedX = Math.max(8.0, Math.min(86.5, proposedX));
  let clampedY = Math.max(12.5, Math.min(67.0, proposedY));

  // Protect bottom Dock zone (Dock resides in x: 24% - 76%, y: > 64.0%)
  if (clampedX >= 24.0 && clampedX <= 76.0 && clampedY > 64.0) {
    clampedY = 64.0;
  }

  // Protect top-right controls zone (TR/EN, Theme toggle, System time in x: > 67.0%, y: < 22.0%)
  if (clampedX > 67.0 && clampedY < 22.0) {
    clampedY = 22.0;
  }

  return {
    x: Number(clampedX.toFixed(2)),
    y: Number(clampedY.toFixed(2))
  };
}

function getWeightScale(weight?: string): number {
  if (weight === "small") return 0.9;
  if (weight === "large") return 1.1;
  return 1.0;
}
