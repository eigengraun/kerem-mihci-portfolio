import { NextResponse } from "next/server";
import { getPublishedVideoBySlug } from "@/lib/portfolio/repository";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  try {
    const video = await getPublishedVideoBySlug(decodeURIComponent(slug));
    if (!video) {
      return NextResponse.json(
        { ok: false, error: "Video not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { ok: true, video },
      {
        headers: {
          "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600"
        }
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load video";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
