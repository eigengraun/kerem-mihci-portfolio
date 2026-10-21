import { NextResponse } from "next/server";
import { getPublishedSkills } from "@/lib/portfolio/repository";
import type { CmsSkillCategory } from "@/lib/portfolio/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") as CmsSkillCategory | null;

    const skills = await getPublishedSkills(category || undefined);
    return NextResponse.json(
      { ok: true, count: skills.length, skills },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load public skills";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  }
}
