import { NextResponse } from "next/server";
import { getPublishedGallery } from "@/lib/portfolio/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const gallery = await getPublishedGallery();
    return NextResponse.json(
      {
        ok: true,
        count: gallery.length,
        gallery
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
      { ok: false, error: message, count: 0, gallery: [] },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
