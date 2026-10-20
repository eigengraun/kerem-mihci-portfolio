import { NextResponse } from "next/server";
import { getPublishedGalleryWithMeta } from "@/lib/portfolio/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await getPublishedGalleryWithMeta();

    if (res.degraded) {
      return NextResponse.json(
        {
          ok: false,
          degraded: true,
          error: res.reason || "Gallery service temporarily unavailable.",
          count: 0,
          gallery: []
        },
        {
          status: 503,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate"
          }
        }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        count: res.gallery.length,
        gallery: res.gallery
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate"
        }
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load gallery";
    return NextResponse.json(
      { ok: false, degraded: true, error: message, count: 0, gallery: [] },
      { status: 503, headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  }
}
