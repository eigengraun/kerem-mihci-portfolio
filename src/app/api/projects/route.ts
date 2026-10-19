import { NextResponse } from "next/server";
import { getPublishedProjects } from "@/lib/portfolio/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const projects = await getPublishedProjects();
  return NextResponse.json(
    {
      ok: true,
      count: projects.length,
      projects
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    }
  );
}
