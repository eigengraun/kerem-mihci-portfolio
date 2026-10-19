import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { getCmsStorageMode } from "@/lib/portfolio/d1Engine";

export const ADMIN_SESSION_COOKIE = "km_admin_session";
export const ADMIN_CSRF_COOKIE = "km_admin_csrf";
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours

export interface AdminSessionPayload {
  jti: string;
  email: string;
  name: string;
  mode: "google-oauth" | "master-password" | "dev-fixture";
  iat: number;
  exp: number;
  csrfToken: string;
}

// In-memory rate limiter for failed login attempts
const loginAttemptMap = new Map<string, { count: number; resetAt: number }>();
const MAX_LOGIN_ATTEMPTS = 8;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Server-side revoked session JTI registry (invalidates logged-out tokens immediately)
const revokedSessionJtis = new Set<string>();

export function checkLoginRateLimit(ip: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = loginAttemptMap.get(ip);
  if (!entry || now > entry.resetAt) {
    return { allowed: true, retryAfterSec: 0 };
  }
  if (entry.count >= MAX_LOGIN_ATTEMPTS) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000))
    };
  }
  return { allowed: true, retryAfterSec: 0 };
}

export function recordFailedLoginAttempt(ip: string): void {
  const now = Date.now();
  const entry = loginAttemptMap.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttemptMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

export function clearLoginRateLimit(ip: string): void {
  loginAttemptMap.delete(ip);
}

/**
 * Strictly disables dev-fixture bypass in production storage mode.
 */
export function isDevFixtureAllowed(): boolean {
  if (getCmsStorageMode() === "production") {
    return false;
  }
  if (process.env.ADMIN_DEV_AUTH_BYPASS === "true") {
    return true;
  }
  return process.env.NODE_ENV !== "production";
}

export function getAdminAuthConfigStatus() {
  const storageMode = getCmsStorageMode();
  const hasSessionSecret = Boolean(
    process.env.ADMIN_SESSION_SECRET && process.env.ADMIN_SESSION_SECRET.trim().length >= 16
  );

  const rawEmails =
    process.env.ADMIN_ALLOWED_EMAILS ||
    (storageMode === "production" ? "" : "kerem@keremmihci.com,admin@keremmihci.com");
  const allowedEmails = rawEmails
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const hasGoogleOAuth = Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET
  );
  const hasPasswordHash = Boolean(
    process.env.ADMIN_PASSWORD_HASH && process.env.ADMIN_PASSWORD_HASH.trim().length >= 16
  );
  const hasMasterPassword = Boolean(
    hasPasswordHash ||
      (process.env.ADMIN_MASTER_PASSWORD && process.env.ADMIN_MASTER_PASSWORD.trim().length >= 8)
  );
  const devFixtureEnabled = isDevFixtureAllowed();

  const productionReady =
    hasSessionSecret && (hasGoogleOAuth || hasMasterPassword) && allowedEmails.length > 0;

  return {
    productionReady,
    hasSessionSecret,
    hasGoogleOAuth,
    hasPasswordHash,
    hasMasterPassword,
    devFixtureEnabled,
    allowedEmails
  };
}

export function hashAdminPasswordScrypt(password: string, saltHex?: string): string {
  const salt = saltHex ? Buffer.from(saltHex, "hex") : crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;
}

export function verifyAdminPasswordConstantTime(candidatePassword: string): boolean {
  const configuredHash = (process.env.ADMIN_PASSWORD_HASH || "").trim();
  if (configuredHash.startsWith("scrypt:")) {
    const parts = configuredHash.split(":");
    if (parts.length !== 3) return false;
    const [, saltHex, expectedKeyHex] = parts;
    try {
      const salt = Buffer.from(saltHex, "hex");
      const expectedKey = Buffer.from(expectedKeyHex, "hex");
      const actualKey = crypto.scryptSync(candidatePassword, salt, expectedKey.length);
      return (
        actualKey.length === expectedKey.length &&
        crypto.timingSafeEqual(actualKey, expectedKey)
      );
    } catch {
      return false;
    }
  }

  if (configuredHash.startsWith("sha256:")) {
    const expectedHex = configuredHash.slice("sha256:".length).trim();
    const actualHex = crypto.createHash("sha256").update(candidatePassword, "utf8").digest("hex");
    const a = Buffer.from(actualHex, "utf8");
    const b = Buffer.from(expectedHex, "utf8");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  const configuredMaster = process.env.ADMIN_MASTER_PASSWORD || "";
  if (!configuredMaster || configuredMaster.length < 8) {
    return false;
  }

  // Constant-time comparison via fixed-length SHA-256 HMAC so password length is never leaked
  const key = "km-admin-password-compare-key";
  const candidateDigest = crypto.createHmac("sha256", key).update(candidatePassword, "utf8").digest();
  const masterDigest = crypto.createHmac("sha256", key).update(configuredMaster, "utf8").digest();
  return crypto.timingSafeEqual(candidateDigest, masterDigest);
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

function timingSafeCompareStrings(a: string, b: string): boolean {
  const key = "km-csrf-compare";
  const da = crypto.createHmac("sha256", key).update(a, "utf8").digest();
  const db = crypto.createHmac("sha256", key).update(b, "utf8").digest();
  return a.length === b.length && crypto.timingSafeEqual(da, db);
}

export function signAdminSessionToken(payload: AdminSessionPayload): string {
  const secret = getSigningSecret();
  const data = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function revokeAdminSessionToken(token: string | undefined | null): void {
  if (!token || !token.includes(".")) return;
  try {
    const [data] = token.split(".");
    if (!data) return;
    const payload = JSON.parse(
      Buffer.from(data, "base64url").toString("utf-8")
    ) as Partial<AdminSessionPayload>;
    if (payload.jti) {
      if (revokedSessionJtis.size > 5000) {
        revokedSessionJtis.clear();
      }
      revokedSessionJtis.add(payload.jti);
    }
  } catch {
    // ignore malformed token
  }
}

export function verifyAdminSessionToken(
  token: string | undefined | null
):
  | { status: "valid"; payload: AdminSessionPayload }
  | { status: "unauthorized"; reason: string }
  | { status: "forbidden"; reason: string } {
  if (!token || !token.includes(".")) {
    return { status: "unauthorized", reason: "Missing or malformed session token." };
  }
  try {
    const secret = getSigningSecret();
    const parts = token.split(".");
    if (parts.length !== 2) {
      return { status: "unauthorized", reason: "Malformed session token structure." };
    }
    const [data, providedSig] = parts;
    if (!data || !providedSig) {
      return { status: "unauthorized", reason: "Incomplete session token." };
    }
    const expectedSig = crypto.createHmac("sha256", secret).update(data).digest("base64url");
    if (!timingSafeCompareStrings(providedSig, expectedSig)) {
      return { status: "unauthorized", reason: "Invalid session token signature." };
    }
    const payload = JSON.parse(
      Buffer.from(data, "base64url").toString("utf-8")
    ) as AdminSessionPayload;
    if (!payload.exp || Date.now() > payload.exp) {
      return { status: "unauthorized", reason: "Session token has expired." };
    }
    if (payload.jti && revokedSessionJtis.has(payload.jti)) {
      return { status: "unauthorized", reason: "Session token has been revoked." };
    }
    if (payload.mode === "dev-fixture" && !isDevFixtureAllowed()) {
      return { status: "unauthorized", reason: "Dev fixture sessions are rejected in production." };
    }

    const config = getAdminAuthConfigStatus();
    const emailNorm = (payload.email || "").trim().toLowerCase();
    if (!emailNorm || !config.allowedEmails.includes(emailNorm)) {
      return {
        status: "forbidden",
        reason: "Forbidden: Authenticated identity is not in ADMIN_ALLOWED_EMAILS."
      };
    }

    return { status: "valid", payload };
  } catch {
    return { status: "unauthorized", reason: "Invalid session token." };
  }
}

export function createSessionPayload(
  email: string,
  name: string,
  mode: AdminSessionPayload["mode"]
): AdminSessionPayload {
  const now = Date.now();
  return {
    jti: crypto.randomUUID(),
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
    return null;
  }
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const result = verifyAdminSessionToken(rawToken);
  return result.status === "valid" ? result.payload : null;
}

/**
 * Enforces server-side authentication, admin allowlist authorization, CSRF token binding,
 * and Same-Origin verification on every `/api/admin/*` route.
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
          code: "ADMIN_CREDENTIALS_NOT_CONFIGURED",
          error: "Admin authentication is not configured in production (fail-closed)."
        },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      )
    };
  }

  const cookieStore = await cookies();
  const rawToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const verification = verifyAdminSessionToken(rawToken);

  if (verification.status === "unauthorized") {
    return {
      errorResponse: NextResponse.json(
        { ok: false, error: `Unauthorized: ${verification.reason}` },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      )
    };
  }

  if (verification.status === "forbidden") {
    return {
      errorResponse: NextResponse.json(
        { ok: false, error: verification.reason },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      )
    };
  }

  const session = verification.payload;

  // Enforce mandatory CSRF token and Same-Origin check on all state-changing requests
  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    const csrfHeader = (request.headers.get("x-csrf-token") || "").trim();
    if (!csrfHeader || !timingSafeCompareStrings(csrfHeader, session.csrfToken)) {
      return {
        errorResponse: NextResponse.json(
          { ok: false, error: "Forbidden: Missing or invalid CSRF token." },
          { status: 403, headers: { "Cache-Control": "no-store" } }
        )
      };
    }

    const hdrs = await headers();
    const origin = request.headers.get("origin") || hdrs.get("origin");
    const host =
      request.headers.get("x-forwarded-host") ||
      request.headers.get("host") ||
      hdrs.get("x-forwarded-host") ||
      hdrs.get("host");

    if (origin) {
      try {
        const originUrl = new URL(origin);
        if (host && originUrl.host !== host) {
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
