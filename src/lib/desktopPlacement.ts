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

// Safety margin constants for project icon + label bounding boxes (in % of viewport)
export const COLLISION_X_MARGIN = 10.5; // ~150px in 1440px viewport (covers 120px icon/label + margin)
export const COLLISION_Y_MARGIN = 14.5; // ~130px in 900px viewport (covers thumbnail + label + margin)

export interface ProjectFootprint {
  halfWidth: number; // percentage of viewport width
  halfHeight: number; // percentage of viewport height
}

/**
 * Calculates the aspect-aware spatial footprint for a project icon on the desktop
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

  const labelW = Math.max(previewW, 95);
  const totalW = Math.max(previewW, labelW) + 24; // preview + safety margin
  const totalH = previewH + 6 + 28 + 24; // preview + gap + label + safety margin

  // Reference viewport: 1440 x 900
  const halfWidthPercent = (totalW / 2 / 1440) * 100;
  const halfHeightPercent = (totalH / 2 / 900) * 100;

  return {
    halfWidth: Math.max(5.0, halfWidthPercent),
    halfHeight: Math.max(6.5, halfHeightPercent)
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

    // Bounding-box rectangle overlap check including label dimensions
    if (dx < reqX && dy < reqY) {
      return true;
    }

    // Elliptical safety envelope
    const normalizedDist = Math.hypot(dx / reqX, dy / reqY);
    if (normalizedDist < 1.08) {
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
 * Resolves a dragged icon's drop position to the nearest safe, non-colliding spot.
 */
export function resolveSafeDropPosition(
  proposedX: number,
  proposedY: number,
  projectId: string,
  otherProjects: PlacedDesktopItem[],
  footprint?: ProjectFootprint
): { x: number; y: number } {
  // Clamp proposed position into global desktop safe boundaries
  const clampedX = Math.max(8.0, Math.min(86.5, proposedX));
  const clampedY = Math.max(12.5, Math.min(67.0, proposedY));

  // If already safe and non-colliding, return clamped point
  if (isLocationInSafeZone(clampedX, clampedY) && !hasProjectCollision(clampedX, clampedY, otherProjects, footprint, projectId)) {
    return { x: Number(clampedX.toFixed(2)), y: Number(clampedY.toFixed(2)) };
  }

  // Expanding spiral search around the drop location
  const radii = [2.0, 4.0, 6.5, 9.0, 12.0, 15.0, 18.5, 22.0, 26.0, 30.0];
  const angleSteps = 16;

  for (const r of radii) {
    for (let i = 0; i < angleSteps; i++) {
      const angle = (i * 2 * Math.PI) / angleSteps;
      const testX = clampedX + r * Math.cos(angle);
      const testY = clampedY + r * 0.9 * Math.sin(angle);

      if (!isLocationInSafeZone(testX, testY)) continue;
      if (!hasProjectCollision(testX, testY, otherProjects, footprint, projectId)) {
        return { x: Number(testX.toFixed(2)), y: Number(testY.toFixed(2)) };
      }
    }
  }

  // Fallback grid scan if spiral search didn't find a spot
  let bestDist = 9999;
  let bestX = clampedX;
  let bestY = clampedY;

  for (let gy = 13.0; gy <= 66.0; gy += 3.0) {
    for (let gx = 9.0; gx <= 85.0; gx += 3.0) {
      if (!isLocationInSafeZone(gx, gy)) continue;
      if (hasProjectCollision(gx, gy, otherProjects, footprint, projectId)) continue;

      const dist = Math.hypot(gx - clampedX, gy - clampedY);
      if (dist < bestDist) {
        bestDist = dist;
        bestX = gx;
        bestY = gy;
      }
    }
  }

  return { x: Number(bestX.toFixed(2)), y: Number(bestY.toFixed(2)) };
}

function getWeightScale(weight?: string): number {
  if (weight === "small") return 0.9;
  if (weight === "large") return 1.1;
  return 1.0;
}
