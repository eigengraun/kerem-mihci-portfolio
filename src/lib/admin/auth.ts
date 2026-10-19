import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

export const ADMIN_SESSION_COOKIE = "km_admin_session";
export const ADMIN_CSRF_COOKIE = "km_admin_csrf";
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours

export interface AdminSessionPayload {
  email: string;
  name: string;
  mode: "google-oauth" | "master-password" | "dev-fixture";
  iat: number;
  exp: number;
  csrfToken: string;
}

// Simple in-memory rate limiter for login attempts
const loginAttemptMap = new Map<string, { count: number; resetAt: number }>();
const MAX_LOGIN_ATTEMPTS = 10;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export function checkLoginRateLimit(ip: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = loginAttemptMap.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttemptMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfterSec: 0 };
  }
  if (entry.count >= MAX_LOGIN_ATTEMPTS) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000))
    };
  }
  entry.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

export function isDevFixtureAllowed(): boolean {
  if (process.env.ADMIN_DEV_AUTH_BYPASS === "true") {
    return true;
  }
  return process.env.NODE_ENV !== "production";
}

export function getAdminAuthConfigStatus() {
  const hasSessionSecret = Boolean(
    process.env.ADMIN_SESSION_SECRET && process.env.ADMIN_SESSION_SECRET.trim().length >= 16
  );
  const allowedEmails = (process.env.ADMIN_ALLOWED_EMAILS || "kerem@keremmihci.com,admin@keremmihci.com")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const hasGoogleOAuth = Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET
  );
  const hasMasterPassword = Boolean(
    process.env.ADMIN_MASTER_PASSWORD && process.env.ADMIN_MASTER_PASSWORD.trim().length >= 8
  );
  const devFixtureEnabled = isDevFixtureAllowed();

  const productionReady = hasSessionSecret && (hasGoogleOAuth || hasMasterPassword) && allowedEmails.length > 0;

  return {
    productionReady,
    hasSessionSecret,
    hasGoogleOAuth,
    hasMasterPassword,
    devFixtureEnabled,
    allowedEmails
  };
}

function getSigningSecret(): string {
  if (process.env.ADMIN_SESSION_SECRET && process.env.ADMIN_SESSION_SECRET.trim().length >= 16) {
    return process.env.ADMIN_SESSION_SECRET.trim();
  }
  if (isDevFixtureAllowed()) {
    return "dev-only-ephemeral-signing-secret-do-not-use-in-prod-987654321";
  }
  throw new Error("ADMIN_SESSION_SECRET is not configured in production.");
}

export function signAdminSessionToken(payload: AdminSessionPayload): string {
  const secret = getSigningSecret();
  const data = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyAdminSessionToken(token: string | undefined | null): AdminSessionPayload | null {
  if (!token || !token.includes(".")) return null;
  try {
    const secret = getSigningSecret();
    const [data, providedSig] = token.split(".");
    if (!data || !providedSig) return null;
    const expectedSig = crypto.createHmac("sha256", secret).update(data).digest("base64url");
    const a = Buffer.from(providedSig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf-8")) as AdminSessionPayload;
    if (!payload.exp || Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function createSessionPayload(
  email: string,
  name: string,
  mode: AdminSessionPayload["mode"]
): AdminSessionPayload {
  const now = Date.now();
  return {
    email: email.toLowerCase().trim(),
    name,
    mode,
    iat: now,
    exp: now + SESSION_DURATION_MS,
    csrfToken: crypto.randomUUID()
  };
}

export async function getServerAdminSession(): Promise<AdminSessionPayload | null> {
  const config = getAdminAuthConfigStatus();
  if (!config.productionReady && !config.devFixtureEnabled) {
    // Fail closed in production when unconfigured
    return null;
  }
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  return verifyAdminSessionToken(rawToken);
}

/**
 * Enforces server-side authentication (and CSRF check on mutating methods) for /api/admin/* routes.
 */
export async function requireAdminApiAuth(
  request: Request
): Promise<{ session: AdminSessionPayload } | { errorResponse: NextResponse }> {
  const config = getAdminAuthConfigStatus();
  if (!config.productionReady && !config.devFixtureEnabled) {
    return {
      errorResponse: NextResponse.json(
        {
          ok: false,
          error: "Admin authentication is not configured in production (fail-closed)."
        },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      )
    };
  }

  const cookieStore = await cookies();
  const rawToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const session = verifyAdminSessionToken(rawToken);

  if (!session) {
    return {
      errorResponse: NextResponse.json(
        { ok: false, error: "Unauthorized: Valid admin session required." },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      )
    };
  }

  // Verify CSRF / Same-Origin on state-changing requests
  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    const csrfHeader = request.headers.get("x-csrf-token");
    const hdrs = await headers();
    const origin = hdrs.get("origin");
    const host = hdrs.get("host");

    if (csrfHeader && csrfHeader !== session.csrfToken) {
      return {
        errorResponse: NextResponse.json(
          { ok: false, error: "Forbidden: Invalid CSRF token." },
          { status: 403, headers: { "Cache-Control": "no-store" } }
        )
      };
    }

    if (origin && host) {
      try {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
          return {
            errorResponse: NextResponse.json(
              { ok: false, error: "Forbidden: Cross-origin admin mutation rejected." },
              { status: 403, headers: { "Cache-Control": "no-store" } }
            )
          };
        }
      } catch {
        return {
          errorResponse: NextResponse.json(
            { ok: false, error: "Forbidden: Malformed Origin header." },
            { status: 403, headers: { "Cache-Control": "no-store" } }
          )
        };
      }
    }
  }

  return { session };
}
