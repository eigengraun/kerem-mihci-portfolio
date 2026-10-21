import { NextResponse } from "next/server";
import { getPublishedWorkspaceNotes } from "@/lib/portfolio/repository";
import type { WorkspaceCategory } from "@/lib/portfolio/types";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;
  if (workspaceId !== "design" && workspaceId !== "web" && workspaceId !== "motion-ai") {
    return NextResponse.json(
      { ok: false, error: "Invalid workspaceId" },
      { status: 400, headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  }

  try {
    const notes = await getPublishedWorkspaceNotes(workspaceId as WorkspaceCategory);
    return NextResponse.json(
      { ok: true, workspaceId, count: notes.length, notes },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load public workspace notes";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  }
}
