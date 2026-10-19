import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ADMIN_CSRF_COOKIE,
  ADMIN_SESSION_COOKIE,
  checkLoginRateLimit,
  clearLoginRateLimit,
  createDurableAdminSession,
  createSessionPayload,
  extractTrustedClientIp,
  getAdminAuthConfigStatus,
  getServerAdminSession,
  isDevFixtureAllowed,
  recordFailedLoginAttempt,
  revokeAdminSessionToken,
  sha256Hex,
  signAdminSessionToken,
  validateTrustedAdminOrigin,
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
        hasScryptPasswordHash: config.hasScryptPasswordHash,
        hasMasterPassword: config.hasMasterPassword,
        devFixtureEnabled: config.devFixtureEnabled,
        explicitAdminEmailsConfigured: config.explicitAdminEmailsConfigured
      }
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  // If Origin header is present, enforce trusted origin validation (rejects cross-origin & forged X-Forwarded-Host)
  if (request.headers.get("origin")) {
    const originCheck = await validateTrustedAdminOrigin(request);
    if (!originCheck.ok) {
      return originCheck.errorResponse;
    }
  }

  let body: {
    mode?: string;
    email?: string;
    password?: string;
    ttlSeconds?: number;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON payload" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const trustedIp = extractTrustedClientIp(request);
  const candidateEmailForRateLimit = (body.email || "").trim().toLowerCase();

  const rate = await checkLoginRateLimit(trustedIp, candidateEmailForRateLimit);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: `Too many failed login attempts. Please wait ${rate.retryAfterSec} seconds.`,
        retryAfterSec: rate.retryAfterSec
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

  const mode = body.mode || "master-password";
  let authenticatedEmail = "";
  let authenticatedName = "";
  let sessionMode: "google-oauth" | "master-password" | "dev-fixture" = "master-password";

  if (mode === "dev-fixture") {
    if (!isDevFixtureAllowed()) {
      const failRes = await recordFailedLoginAttempt(trustedIp, candidateEmailForRateLimit);
      if (failRes.locked) {
        return NextResponse.json(
          {
            ok: false,
            error: `Too many failed login attempts. Please wait ${failRes.retryAfterSec} seconds.`,
            retryAfterSec: failRes.retryAfterSec
          },
          {
            status: 429,
            headers: {
              "Cache-Control": "no-store",
              "Retry-After": String(failRes.retryAfterSec)
            }
          }
        );
      }
      return NextResponse.json(
        { ok: false, error: "Development fixture login is disabled in production." },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }
    const candidateEmail = (body.email || config.allowedEmails[0] || "")
      .trim()
      .toLowerCase();
    if (!candidateEmail || !config.allowedEmails.includes(candidateEmail)) {
      const failRes = await recordFailedLoginAttempt(trustedIp, candidateEmail);
      if (failRes.locked) {
        return NextResponse.json(
          {
            ok: false,
            error: `Too many failed login attempts. Please wait ${failRes.retryAfterSec} seconds.`,
            retryAfterSec: failRes.retryAfterSec
          },
          {
            status: 429,
            headers: {
              "Cache-Control": "no-store",
              "Retry-After": String(failRes.retryAfterSec)
            }
          }
        );
      }
      return NextResponse.json(
        { ok: false, error: "Email address is not in ADMIN_ALLOWED_EMAILS." },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }
    authenticatedEmail = candidateEmail;
    authenticatedName = "Admin (Dev Fixture)";
    sessionMode = "dev-fixture";
  } else {
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";

    if (!config.hasMasterPassword) {
      return NextResponse.json(
        {
          ok: false,
          error:
            getCmsStorageMode() === "production"
              ? "ADMIN_PASSWORD_HASH (scrypt:<salt>:<key>) is required in production."
              : "ADMIN_PASSWORD_HASH or ADMIN_MASTER_PASSWORD is not configured on the server."
        },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!email || !config.allowedEmails.includes(email)) {
      const failRes = await recordFailedLoginAttempt(trustedIp, email);
      if (failRes.locked) {
        return NextResponse.json(
          {
            ok: false,
            error: `Too many failed login attempts. Please wait ${failRes.retryAfterSec} seconds.`,
            retryAfterSec: failRes.retryAfterSec
          },
          {
            status: 429,
            headers: {
              "Cache-Control": "no-store",
              "Retry-After": String(failRes.retryAfterSec)
            }
          }
        );
      }
      return NextResponse.json(
        { ok: false, error: "Email address is not in ADMIN_ALLOWED_EMAILS." },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!verifyAdminPasswordConstantTime(password)) {
      const failRes = await recordFailedLoginAttempt(trustedIp, email);
      if (failRes.locked) {
        return NextResponse.json(
          {
            ok: false,
            error: `Too many failed login attempts. Please wait ${failRes.retryAfterSec} seconds.`,
            retryAfterSec: failRes.retryAfterSec
          },
          {
            status: 429,
            headers: {
              "Cache-Control": "no-store",
              "Retry-After": String(failRes.retryAfterSec)
            }
          }
        );
      }
      return NextResponse.json(
        { ok: false, error: "Invalid credentials." },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    authenticatedEmail = email;
    authenticatedName = "Portfolio Admin";
    sessionMode = "master-password";
  }

  await clearLoginRateLimit(trustedIp, authenticatedEmail);

  const customDurationMs =
    typeof body.ttlSeconds === "number" &&
    body.ttlSeconds > 0 &&
    body.ttlSeconds <= 28800
      ? body.ttlSeconds * 1000
      : undefined;

  const payload = createSessionPayload(
    authenticatedEmail,
    authenticatedName,
    sessionMode,
    customDurationMs
  );
  const signedToken = signAdminSessionToken(payload);

  try {
    await createDurableAdminSession(payload, {
      ip: trustedIp,
      userAgent: request.headers.get("user-agent") || undefined
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Failed to create durable admin session in D1."
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (getCmsStorageMode() === "local") {
    try {
      const db = getD1Database();
      db.prepare(
        `INSERT INTO admin_audit_logs (id, actor_email, action, entity_type, entity_id, details_json, ip_address, created_at)
         VALUES (?, ?, 'admin_login', 'session', ?, ?, ?, ?)`
      ).run(
        `audit-${crypto.randomUUID()}`,
        authenticatedEmail,
        sha256Hex(payload.jti),
        JSON.stringify({ mode: sessionMode }),
        trustedIp,
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

  const isProd = process.env.NODE_ENV === "production" && getCmsStorageMode() === "production";
  const maxAgeSec = Math.max(1, Math.floor((payload.exp - payload.iat) / 1000));
  response.cookies.set(ADMIN_SESSION_COOKIE, signedToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: maxAgeSec
  });
  response.cookies.set(ADMIN_CSRF_COOKIE, payload.csrfToken, {
    httpOnly: false,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: maxAgeSec
  });

  return response;
}

export async function DELETE(request: Request) {
  if (request.headers.get("origin")) {
    const originCheck = await validateTrustedAdminOrigin(request);
    if (!originCheck.ok) {
      return originCheck.errorResponse;
    }
  }

  const url = new URL(request.url);
  const revokeAll = url.searchParams.get("all") === "true";

  const cookieStore = await cookies();
  const rawToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  let revokeResult = { revoked: false, revokedCount: 0 };
  if (rawToken) {
    revokeResult = await revokeAdminSessionToken(rawToken, {
      revokeAllForActor: revokeAll,
      reason: revokeAll ? "global_logout" : "user_logout"
    });
  }

  const response = NextResponse.json(
    {
      ok: true,
      revoked: revokeResult.revoked,
      revokedCount: revokeResult.revokedCount,
      globalLogout: revokeAll
    },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
  response.cookies.delete(ADMIN_SESSION_COOKIE);
  response.cookies.delete(ADMIN_CSRF_COOKIE);
  return response;
}
