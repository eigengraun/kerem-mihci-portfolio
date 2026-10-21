import { NextResponse } from "next/server";
import { getPublishedEducation } from "@/lib/portfolio/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const education = await getPublishedEducation();
    return NextResponse.json(
      { ok: true, count: education.length, education },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load public education";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  }
}
