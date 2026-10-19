import { NextResponse } from "next/server";
import {
  getPublishedProjectsWithMeta,
  type PublishedProjectsReadResult
} from "@/lib/portfolio/repository";

export const dynamic = "force-dynamic";

/**
 * Observable snapshot state for monitoring/verification:
 * - `live`: fresh read from canonical storage (Worker D1, local D1, or legacy static pre-cutover)
 * - `degraded-cached-snapshot`: Worker outage; serving TTL-bounded, tombstone-filtered snapshot
 * - `degraded-cold-start-outage`: Worker outage with no snapshot; fail-closed (503)
 */
function snapshotStateHeader(source: PublishedProjectsReadResult["source"]): string {
  switch (source) {
    case "stale-verified-snapshot":
      return "degraded-cached-snapshot";
    case "degraded-cold-start-outage":
      return "degraded-cold-start-outage";
    default:
      return "live";
  }
}

export async function GET() {
  const result = await getPublishedProjectsWithMeta();
  const stateHeader = snapshotStateHeader(result.source);

  if (result.source === "degraded-cold-start-outage") {
    return NextResponse.json(
      {
        ok: false,
        degraded: true,
        source: result.source,
        error:
          result.reason ||
          "Portfolio content service is temporarily unavailable during cold-start outage.",
        count: 0,
        projects: []
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "X-Portfolio-Snapshot-State": stateHeader
        }
      }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      degraded: result.degraded,
      source: result.source,
      ...(result.reason ? { reason: result.reason } : {}),
      count: result.projects.length,
      projects: result.projects
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Portfolio-Snapshot-State": stateHeader
      }
    }
  );
}
