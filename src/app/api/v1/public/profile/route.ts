import { NextResponse } from "next/server";
import { getPublishedProfile } from "@/lib/portfolio/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const profile = await getPublishedProfile();
    if (!profile) {
      return NextResponse.json(
        { ok: false, error: "Profile not found or not published" },
        { status: 404, headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
      );
    }
    return NextResponse.json(
      { ok: true, profile },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load public profile";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  }
}
