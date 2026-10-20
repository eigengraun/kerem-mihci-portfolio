import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/admin/auth";
import {
  getAdminVideos,
  saveAdminVideo,
  updateVideoOrderingInD1,
  getD1HealthAndStats
} from "@/lib/portfolio/repository";
import {
  CmsStorageUnavailableError,
  calculateVideoCompleteness,
  type CmsPublishStatus,
  type UpsertVideoInput
} from "@/lib/portfolio/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdminApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const videos = await getAdminVideos();
    const videosWithCompleteness = videos.map((v) => ({
      ...v,
      completeness: calculateVideoCompleteness(v)
    }));
    const health = await getD1HealthAndStats();

    return NextResponse.json(
      {
        ok: true,
        videos: videosWithCompleteness,
        health
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 500;
    const message = error instanceof Error ? error.message : "Failed to load admin videos";
    return NextResponse.json(
      {
        ok: false,
        code: error instanceof CmsStorageUnavailableError ? error.code : "ADMIN_VIDEOS_ERROR",
        error: message
      },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    let body: UpsertVideoInput & {
      actionType?: "create" | "update" | "reorder";
      orderings?: { id: string; sortOrder: number }[];
      status?: CmsPublishStatus;
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON payload" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (body.actionType === "reorder" && Array.isArray(body.orderings)) {
      const result = await updateVideoOrderingInD1(body.orderings, auth.session.email);
      const updated = await getAdminVideos();
      return NextResponse.json(
        {
          ok: true,
          updatedCount: result.updatedCount,
          videos: updated.map((v) => ({
            ...v,
            completeness: calculateVideoCompleteness(v)
          }))
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const actionType: "create" | "update" =
      body.actionType === "create" || (!body.id && !body.actionType)
        ? "create"
        : "update";

    const saved = await saveAdminVideo(
      {
        ...body,
        cmsStatus: body.cmsStatus || body.status || "draft"
      },
      auth.session.email,
      actionType
    );

    return NextResponse.json(
      {
        ok: true,
        video: {
          ...saved,
          completeness: calculateVideoCompleteness(saved)
        }
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 400;
    const message = error instanceof Error ? error.message : "Failed to save video";
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
