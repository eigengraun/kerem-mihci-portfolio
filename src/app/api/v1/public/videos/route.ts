import { NextResponse } from "next/server";
import { getPublishedVideos } from "@/lib/portfolio/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const videos = await getPublishedVideos();
    return NextResponse.json(
      {
        ok: true,
        count: videos.length,
        videos
      },
      {
        headers: {
          "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600"
        }
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load videos";
    return NextResponse.json(
      { ok: false, error: message, count: 0, videos: [] },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
