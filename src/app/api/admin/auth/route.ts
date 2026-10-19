import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ADMIN_CSRF_COOKIE,
  ADMIN_SESSION_COOKIE,
  checkLoginRateLimit,
  clearLoginRateLimit,
  createSessionPayload,
  getAdminAuthConfigStatus,
  getServerAdminSession,
  isDevFixtureAllowed,
  recordFailedLoginAttempt,
  revokeAdminSessionToken,
  signAdminSessionToken,
  verifyAdminPasswordConstantTime
} from "@/lib/admin/auth";
import { getCmsStorageMode, getD1Database } from "@/lib/portfolio/d1Engine";

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
        hasPasswordHash: config.hasPasswordHash,
        hasMasterPassword: config.hasMasterPassword,
        devFixtureEnabled: config.devFixtureEnabled
      }
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "127.0.0.1";

  const rate = checkLoginRateLimit(ip);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: `Too many failed login attempts. Please wait ${rate.retryAfterSec} seconds.`
      },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(rate.retryAfterSec)
        }
      }
    );
  }

  const config = getAdminAuthConfigStatus();
  if (!config.productionReady && !config.devFixtureEnabled) {
    return NextResponse.json(
      {
        ok: false,
        code: "ADMIN_CREDENTIALS_NOT_CONFIGURED",
        error: "Admin authentication is not configured in production (fail-closed)."
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  let body: { mode?: string; email?: string; password?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON payload" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const mode = body.mode || "master-password";
  let authenticatedEmail = "";
  let authenticatedName = "";
  let sessionMode: "google-oauth" | "master-password" | "dev-fixture" = "master-password";

  if (mode === "dev-fixture") {
    if (!isDevFixtureAllowed()) {
      recordFailedLoginAttempt(ip);
      return NextResponse.json(
        { ok: false, error: "Development fixture login is disabled in production." },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }
    const candidateEmail = (body.email || config.allowedEmails[0] || "kerem@keremmihci.com")
      .trim()
      .toLowerCase();
    if (!config.allowedEmails.includes(candidateEmail)) {
      recordFailedLoginAttempt(ip);
      return NextResponse.json(
        { ok: false, error: "Email address is not in ADMIN_ALLOWED_EMAILS." },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }
    authenticatedEmail = candidateEmail;
    authenticatedName = "Kerem Mıhçı (Dev Admin)";
    sessionMode = "dev-fixture";
  } else {
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";

    if (!config.hasMasterPassword) {
      return NextResponse.json(
        {
          ok: false,
          error: "ADMIN_PASSWORD_HASH or ADMIN_MASTER_PASSWORD is not configured on the server."
        },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!config.allowedEmails.includes(email)) {
      recordFailedLoginAttempt(ip);
      return NextResponse.json(
        { ok: false, error: "Email address is not in ADMIN_ALLOWED_EMAILS." },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!verifyAdminPasswordConstantTime(password)) {
      recordFailedLoginAttempt(ip);
      return NextResponse.json(
        { ok: false, error: "Invalid credentials." },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    authenticatedEmail = email;
    authenticatedName = "Kerem Mıhçı";
    sessionMode = "master-password";
  }

  clearLoginRateLimit(ip);
  const payload = createSessionPayload(authenticatedEmail, authenticatedName, sessionMode);
  const signedToken = signAdminSessionToken(payload);

  if (getCmsStorageMode() === "local") {
    try {
      const db = getD1Database();
      db.prepare(
        `INSERT INTO admin_audit_logs (id, actor_email, action, entity_type, entity_id, details_json, ip_address, created_at)
         VALUES (?, ?, 'admin_login', 'session', ?, ?, ?, ?)`
      ).run(
        `audit-${crypto.randomUUID()}`,
        authenticatedEmail,
        payload.jti,
        JSON.stringify({ mode: sessionMode }),
        ip,
        new Date().toISOString()
      );
    } catch {
      // non-blocking
    }
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
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (rawToken) {
    revokeAdminSessionToken(rawToken);
  }

  const response = NextResponse.json(
    { ok: true, revoked: Boolean(rawToken) },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
  response.cookies.delete(ADMIN_SESSION_COOKIE);
  response.cookies.delete(ADMIN_CSRF_COOKIE);
  return response;
}
