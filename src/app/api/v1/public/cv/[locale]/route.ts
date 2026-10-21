import { NextResponse } from "next/server";
import { getPublishedCv } from "@/lib/portfolio/repository";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string }> }
) {
  const { locale } = await params;
  if (locale !== "tr" && locale !== "en") {
    return NextResponse.json(
      { ok: false, error: "Invalid locale" },
      { status: 400, headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  }

  try {
    const doc = await getPublishedCv(locale);
    if (!doc) {
      return NextResponse.json(
        { ok: false, error: "CV document not found or not published" },
        { status: 404, headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
      );
    }
    return NextResponse.json(
      { ok: true, cv: doc },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load public CV document";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  }
}
