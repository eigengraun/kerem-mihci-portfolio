import { NextResponse } from "next/server";
import { getPublishedExperience } from "@/lib/portfolio/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    const experience = await getPublishedExperience(category || undefined);
    return NextResponse.json(
      { ok: true, count: experience.length, experience },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load public experience";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  }
}
