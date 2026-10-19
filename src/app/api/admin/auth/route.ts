import crypto from "node:crypto";
import { NextResponse } from "next/server";
import {
  ADMIN_CSRF_COOKIE,
  ADMIN_SESSION_COOKIE,
  checkLoginRateLimit,
  createSessionPayload,
  getAdminAuthConfigStatus,
  getServerAdminSession,
  isDevFixtureAllowed,
  signAdminSessionToken
} from "@/lib/admin/auth";
import { getD1Database } from "@/lib/portfolio/d1Engine";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerAdminSession();
  const config = getAdminAuthConfigStatus();
  return NextResponse.json(
    {
      ok: true,
      authenticated: Boolean(session),
      session,
      config: {
        productionReady: config.productionReady,
        hasGoogleOAuth: config.hasGoogleOAuth,
        hasMasterPassword: config.hasMasterPassword,
        devFixtureEnabled: config.devFixtureEnabled
      }
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "127.0.0.1";

  const rate = checkLoginRateLimit(ip);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: `Too many login attempts. Please wait ${rate.retryAfterSec} seconds.`
      },
      { status: 429, headers: { "Cache-Control": "no-store" } }
    );
  }

  const config = getAdminAuthConfigStatus();
  if (!config.productionReady && !config.devFixtureEnabled) {
    return NextResponse.json(
      {
        ok: false,
        error: "Admin authentication is not configured in production (fail-closed)."
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  let body: { mode?: string; email?: string; password?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
  }

  const mode = body.mode || "master-password";
  let authenticatedEmail = "";
  let authenticatedName = "";
  let sessionMode: "google-oauth" | "master-password" | "dev-fixture" = "master-password";

  if (mode === "dev-fixture") {
    if (!isDevFixtureAllowed()) {
      return NextResponse.json(
        { ok: false, error: "Development fixture login is disabled in production." },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }
    authenticatedEmail = (body.email || config.allowedEmails[0] || "dev-admin@keremmihci.com")
      .trim()
      .toLowerCase();
    authenticatedName = "Kerem Mıhçı (Dev Admin)";
    sessionMode = "dev-fixture";
  } else {
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";
    const configuredMaster = process.env.ADMIN_MASTER_PASSWORD || "";

    if (!configuredMaster || configuredMaster.length < 8) {
      return NextResponse.json(
        {
          ok: false,
          error: "ADMIN_MASTER_PASSWORD is not configured on the server."
        },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!config.allowedEmails.includes(email)) {
      return NextResponse.json(
        { ok: false, error: "Email address is not in ADMIN_ALLOWED_EMAILS." },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    const a = Buffer.from(password);
    const b = Buffer.from(configuredMaster);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return NextResponse.json(
        { ok: false, error: "Invalid credentials." },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    authenticatedEmail = email;
    authenticatedName = "Kerem Mıhçı";
    sessionMode = "master-password";
  }

  const payload = createSessionPayload(authenticatedEmail, authenticatedName, sessionMode);
  const signedToken = signAdminSessionToken(payload);

  try {
    const db = getD1Database();
    db.prepare(
      `INSERT INTO admin_audit_logs (id, actor_email, action, entity_type, entity_id, details_json, ip_address, created_at)
       VALUES (?, ?, 'admin_login', 'session', ?, ?, ?, ?)`
    ).run(
      `audit-${crypto.randomUUID()}`,
      authenticatedEmail,
      sessionMode,
      JSON.stringify({ mode: sessionMode }),
      ip,
      new Date().toISOString()
    );
  } catch {
    // non-blocking if audit log fails
  }

  const response = NextResponse.json(
    {
      ok: true,
      session: payload
    },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );

  const isProd = process.env.NODE_ENV === "production";
  response.cookies.set(ADMIN_SESSION_COOKIE, signedToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: 12 * 60 * 60
  });
  response.cookies.set(ADMIN_CSRF_COOKIE, payload.csrfToken, {
    httpOnly: false,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: 12 * 60 * 60
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json(
    { ok: true },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
  response.cookies.delete(ADMIN_SESSION_COOKIE);
  response.cookies.delete(ADMIN_CSRF_COOKIE);
  return response;
}
