import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/admin/auth";
import { uploadCvDocument } from "@/lib/portfolio/repository";
import { CmsStorageUnavailableError } from "@/lib/portfolio/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdminApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const locale = formData.get("locale") as string | null;

    if (!file) {
      return NextResponse.json(
        { ok: false, error: "PDF file is required" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!locale || (locale !== "tr" && locale !== "en")) {
      return NextResponse.json(
        { ok: false, error: "Valid locale ('tr' or 'en') is required" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const doc = await uploadCvDocument({
      buffer,
      filename: file.name,
      locale,
      actorEmail: auth.session.email
    });

    return NextResponse.json(
      { ok: true, cv: doc },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof CmsStorageUnavailableError ? 503 : 400;
    const message = error instanceof Error ? error.message : "Failed to upload CV document";
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
