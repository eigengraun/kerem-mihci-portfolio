import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/admin/auth";
import {
  fetchGa4Analytics,
  fetchSearchConsoleAnalytics,
  buildProjectLevelAnalytics,
  type AnalyticsDateRange
} from "@/lib/admin/googleAnalyticsAndGsc";
import { getAdminProjects, getPublishedProjects } from "@/lib/portfolio/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdminApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  const url = new URL(request.url);
  const rawRange = url.searchParams.get("range") || "28d";
  const range: AnalyticsDateRange =
    rawRange === "7d" || rawRange === "90d" ? rawRange : "28d";

  const [ga4, gsc, projects] = await Promise.all([
    fetchGa4Analytics(range),
    fetchSearchConsoleAnalytics(range),
    getAdminProjects().catch(() => getPublishedProjects())
  ]);

  const projectInsights = buildProjectLevelAnalytics(projects, ga4, gsc);

  return NextResponse.json(
    {
      ok: true,
      range,
      ga4,
      gsc,
      projectInsights
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
