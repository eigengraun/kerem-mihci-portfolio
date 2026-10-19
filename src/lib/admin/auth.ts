import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import {
  checkDurableLoginRateLimitInLocalD1,
  clearDurableLoginRateLimitInLocalD1,
  createDurableAdminSessionInLocalD1,
  getCmsStorageMode,
  recordDurableFailedLoginInLocalD1,
  revokeDurableAdminSessionInLocalD1,
  verifyDurableAdminSessionInLocalD1
} from "@/lib/portfolio/d1Engine";

export const ADMIN_SESSION_COOKIE = "km_admin_session";
export const ADMIN_CSRF_COOKIE = "km_admin_csrf";
const DEFAULT_SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours

export interface AdminSessionPayload {
  jti: string;
  email: string;
  name: string;
  mode: "google-oauth" | "master-password" | "dev-fixture";
  iat: number;
  exp: number;
  csrfToken: string;
}

export function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

function timingSafeCompareStrings(a: string, b: string): boolean {
  const key = "km-constant-time-compare";
  const da = crypto.createHmac("sha256", key).update(a, "utf8").digest();
  const db = crypto.createHmac("sha256", key).update(b, "utf8").digest();
  return a.length === b.length && crypto.timingSafeEqual(da, db);
}

/**
 * Extracts client IP safely.
 * NEVER trusts client-supplied X-Forwarded-For or X-Real-IP headers unless
 * TRUSTED_PROXY_SHARED_SECRET is configured AND verified on the request.
 */
export function extractTrustedClientIp(request: Request): string {
  const configuredProxySecret = (process.env.TRUSTED_PROXY_SHARED_SECRET || "").trim();
  const providedProxySecret = (request.headers.get("x-trusted-proxy-secret") || "").trim();

  const proxyVerified =
    configuredProxySecret.length >= 16 &&
    providedProxySecret.length > 0 &&
    timingSafeCompareStrings(providedProxySecret, configuredProxySecret);

  if (proxyVerified) {
    const forwarded =
      request.headers.get("cf-connecting-ip")?.trim() ||
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip")?.trim();
    if (forwarded) {
      return forwarded;
    }
  }

  return "direct-untrusted-peer";
}

export function buildLoginRateLimitScopeKeys(
  trustedIp: string,
  candidateEmail?: string
): string[] {
  const ipScope = `ip:${sha256Hex(trustedIp || "direct-untrusted-peer")}`;
  const normEmail = (candidateEmail || "").trim().toLowerCase();
  const acctScope = normEmail
    ? `acct:${sha256Hex(normEmail)}`
    : "endpoint:admin_login_anonymous";
  return [ipScope, acctScope];
}

function getRateLimitParams() {
  const maxAttempts = Math.max(
    1,
    Number(process.env.ADMIN_RATE_LIMIT_MAX_ATTEMPTS || 5)
  );
  const windowSec = Math.max(
    1,
    Number(process.env.ADMIN_RATE_LIMIT_WINDOW_SEC || 15 * 60)
  );
  const lockoutSec = Math.max(
    1,
    Number(process.env.ADMIN_RATE_LIMIT_LOCKOUT_SEC || windowSec)
  );
  return { maxAttempts, windowSec, lockoutSec };
}

function getWorkerConfig(): { workerBase: string; serviceToken: string } | null {
  const workerBase = (process.env.CLOUDFLARE_CMS_API_URL || "").trim().replace(/\/$/, "");
  const serviceToken = (process.env.CLOUDFLARE_API_SERVICE_TOKEN || "").trim();
  if (workerBase && serviceToken) {
    return { workerBase, serviceToken };
  }
  return null;
}

export async function checkLoginRateLimit(
  trustedIp: string,
  candidateEmail?: string
): Promise<{ allowed: boolean; retryAfterSec: number; remainingAttempts: number }> {
  const scopeKeys = buildLoginRateLimitScopeKeys(trustedIp, candidateEmail);
  const worker = getWorkerConfig();
  const storageMode = getCmsStorageMode();
  const { maxAttempts, windowSec, lockoutSec } = getRateLimitParams();

  if (worker) {
    try {
      const res = await fetch(`${worker.workerBase}/api/v1/admin/auth/rate-limit`, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${worker.serviceToken}`
        },
        body: JSON.stringify({
          action: "check",
          scopeKeys,
          maxAttempts,
          windowSec,
          lockoutSec
        })
      });
      if (res.ok) {
        const data = (await res.json()) as {
          allowed?: boolean;
          retryAfterSec?: number;
          remainingAttempts?: number;
        };
        if (storageMode === "local") {
          const localCheck = checkDurableLoginRateLimitInLocalD1({ scopeKeys });
          if (!localCheck.allowed) return localCheck;
        }
        return {
          allowed: Boolean(data.allowed),
          retryAfterSec: Number(data.retryAfterSec || 0),
          remainingAttempts: Number(data.remainingAttempts ?? maxAttempts)
        };
      }
      if (storageMode !== "local") {
        return { allowed: false, retryAfterSec: 60, remainingAttempts: 0 };
      }
    } catch {
      if (storageMode !== "local") {
        return { allowed: false, retryAfterSec: 60, remainingAttempts: 0 };
      }
    }
  } else if (storageMode !== "local") {
    return { allowed: false, retryAfterSec: 60, remainingAttempts: 0 };
  }

  return checkDurableLoginRateLimitInLocalD1({ scopeKeys });
}

export async function recordFailedLoginAttempt(
  trustedIp: string,
  candidateEmail?: string
): Promise<{ locked: boolean; retryAfterSec: number; remainingAttempts: number }> {
  const scopeKeys = buildLoginRateLimitScopeKeys(trustedIp, candidateEmail);
  const worker = getWorkerConfig();
  const storageMode = getCmsStorageMode();
  const { maxAttempts, windowSec, lockoutSec } = getRateLimitParams();

  let localRes = { locked: false, retryAfterSec: 0, remainingAttempts: maxAttempts };
  if (storageMode === "local") {
    localRes = recordDurableFailedLoginInLocalD1({
      scopeKeys,
      maxAttempts,
      windowSec,
      lockoutSec
    });
  }

  if (worker) {
    try {
      const res = await fetch(`${worker.workerBase}/api/v1/admin/auth/rate-limit`, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${worker.serviceToken}`
        },
        body: JSON.stringify({
          action: "record_failure",
          scopeKeys,
          maxAttempts,
          windowSec,
          lockoutSec
        })
      });
      if (res.ok) {
        const data = (await res.json()) as {
          locked?: boolean;
          retryAfterSec?: number;
          remainingAttempts?: number;
        };
        return {
          locked: Boolean(data.locked) || localRes.locked,
          retryAfterSec: Math.max(Number(data.retryAfterSec || 0), localRes.retryAfterSec),
          remainingAttempts: Math.min(
            Number(data.remainingAttempts ?? maxAttempts),
            localRes.remainingAttempts
          )
        };
      }
    } catch {
      // fall through
    }
  }

  return localRes;
}

export async function clearLoginRateLimit(
  trustedIp: string,
  candidateEmail?: string
): Promise<void> {
  const scopeKeys = buildLoginRateLimitScopeKeys(trustedIp, candidateEmail);
  const worker = getWorkerConfig();
  const storageMode = getCmsStorageMode();

  if (storageMode === "local") {
    clearDurableLoginRateLimitInLocalD1(scopeKeys);
  }

  if (worker) {
    try {
      await fetch(`${worker.workerBase}/api/v1/admin/auth/rate-limit`, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${worker.serviceToken}`
        },
        body: JSON.stringify({
          action: "clear",
          scopeKeys
        })
      });
    } catch {
      // ignore
    }
  }
}

/**
 * Strictly disables dev-fixture bypass in production storage mode.
 */
export function isDevFixtureAllowed(): boolean {
  if (getCmsStorageMode() === "production") {
    return false;
  }
  if (process.env.ADMIN_DEV_AUTH_BYPASS === "false") {
    return false;
  }
  if (process.env.ADMIN_DEV_AUTH_BYPASS === "true") {
    return true;
  }
  return process.env.NODE_ENV !== "production" && getCmsStorageMode() === "local";
}

export function isScryptPasswordHash(hash: string): boolean {
  if (!hash.startsWith("scrypt:")) return false;
  const parts = hash.split(":");
  if (parts.length !== 3) return false;
  const [, saltHex, keyHex] = parts;
  return /^[0-9a-f]{32,}$/i.test(saltHex) && /^[0-9a-f]{128}$/i.test(keyHex);
}

export function getAdminAuthConfigStatus() {
  const storageMode = getCmsStorageMode();
  const isProdMode = storageMode === "production";
  const hasSessionSecret = Boolean(
    process.env.ADMIN_SESSION_SECRET && process.env.ADMIN_SESSION_SECRET.trim().length >= 16
  );

  // Never assume a hardcoded production admin email; require explicit ADMIN_ALLOWED_EMAILS in staging/production
  const explicitEmailsRaw = (process.env.ADMIN_ALLOWED_EMAILS || "").trim();
  const rawEmails =
    explicitEmailsRaw ||
    (storageMode === "local" && isDevFixtureAllowed()
      ? process.env.ADMIN_DEV_DEFAULT_EMAIL || "local-dev-admin@localhost"
      : "");

  const allowedEmails = rawEmails
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const hasGoogleOAuth = Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET
  );

  const configuredHash = (process.env.ADMIN_PASSWORD_HASH || "").trim();
  const hasScryptPasswordHash = isScryptPasswordHash(configuredHash);
  const hasLegacyHashOrPlain =
    !isProdMode &&
    Boolean(
      configuredHash.startsWith("sha256:") ||
        (process.env.ADMIN_MASTER_PASSWORD && process.env.ADMIN_MASTER_PASSWORD.trim().length >= 8)
    );

  // In production mode, ONLY salted scrypt password hashes are accepted
  const hasPasswordHash = isProdMode
    ? hasScryptPasswordHash
    : hasScryptPasswordHash || configuredHash.startsWith("sha256:");
  const hasMasterPassword = isProdMode
    ? hasScryptPasswordHash
    : hasScryptPasswordHash || hasLegacyHashOrPlain;

  const devFixtureEnabled = isDevFixtureAllowed();

  const productionReady =
    hasSessionSecret &&
    (hasGoogleOAuth || hasMasterPassword) &&
    explicitEmailsRaw.length > 0 &&
    allowedEmails.length > 0;

  return {
    productionReady,
    hasSessionSecret,
    hasGoogleOAuth,
    hasPasswordHash,
    hasScryptPasswordHash,
    hasMasterPassword,
    devFixtureEnabled,
    allowedEmails,
    explicitAdminEmailsConfigured: explicitEmailsRaw.length > 0
  };
}

export function hashAdminPasswordScrypt(password: string, saltHex?: string): string {
  const salt = saltHex ? Buffer.from(saltHex, "hex") : crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;
}

export function verifyAdminPasswordConstantTime(candidatePassword: string): boolean {
  const storageMode = getCmsStorageMode();
  const isProdMode = storageMode === "production";
  const configuredHash = (process.env.ADMIN_PASSWORD_HASH || "").trim();

  if (configuredHash.startsWith("scrypt:")) {
    if (!isScryptPasswordHash(configuredHash)) return false;
    const [, saltHex, expectedKeyHex] = configuredHash.split(":");
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

  // Strictly reject legacy unsalted sha256 or plaintext ADMIN_MASTER_PASSWORD in production mode
  if (isProdMode) {
    return false;
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

export function signAdminSessionToken(payload: AdminSessionPayload): string {
  const secret = getSigningSecret();
  const data = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function decodeAndVerifyAdminSessionTokenSignature(
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
    if (!payload.jti || !payload.csrfToken) {
      return { status: "unauthorized", reason: "Session token missing required claims." };
    }
    if (!payload.exp || Date.now() > payload.exp) {
      return { status: "unauthorized", reason: "Session token has expired." };
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

export async function createDurableAdminSession(
  payload: AdminSessionPayload,
  meta?: { ip?: string; userAgent?: string }
): Promise<void> {
  const jtiHash = sha256Hex(payload.jti);
  const csrfTokenHash = sha256Hex(payload.csrfToken);
  const issuedAt = Math.floor(payload.iat / 1000);
  const expiresAt = Math.floor(payload.exp / 1000);
  const ipHash = meta?.ip ? sha256Hex(meta.ip) : null;
  const userAgent = (meta?.userAgent || "").slice(0, 250) || null;

  const storageMode = getCmsStorageMode();
  const worker = getWorkerConfig();

  if (storageMode === "local") {
    createDurableAdminSessionInLocalD1({
      jtiHash,
      actorEmail: payload.email,
      role: "owner",
      csrfTokenHash,
      issuedAt,
      expiresAt,
      ipHash,
      userAgent
    });
  }

  if (worker) {
    const res = await fetch(`${worker.workerBase}/api/v1/admin/auth/sessions`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${worker.serviceToken}`,
        "X-Actor-Email": payload.email
      },
      body: JSON.stringify({
        action: "create",
        jtiHash,
        csrfTokenHash,
        actorEmail: payload.email,
        role: "owner",
        issuedAt,
        expiresAt,
        ipHash,
        userAgent
      })
    });
    if (!res.ok && storageMode !== "local") {
      throw new Error(`Failed to persist admin session in Cloudflare D1 (HTTP ${res.status}).`);
    }
  } else if (storageMode !== "local") {
    throw new Error("Cloudflare D1 session store is not configured in staging/production.");
  }
}

export async function verifyDurableAdminSession(
  payload: AdminSessionPayload
): Promise<{ valid: boolean; reason?: string }> {
  const jtiHash = sha256Hex(payload.jti);
  const expectedCsrfHash = sha256Hex(payload.csrfToken);
  const storageMode = getCmsStorageMode();
  const worker = getWorkerConfig();

  if (worker) {
    try {
      const res = await fetch(`${worker.workerBase}/api/v1/admin/auth/sessions`, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${worker.serviceToken}`,
          "X-Actor-Email": payload.email
        },
        body: JSON.stringify({
          action: "verify",
          jtiHash
        })
      });
      if (!res.ok) {
        return { valid: false, reason: "Durable session store returned error." };
      }
      const data = (await res.json()) as {
        valid?: boolean;
        reason?: string;
        session?: { csrfTokenHash?: string; actorEmail?: string };
      };
      if (!data.valid || !data.session) {
        return { valid: false, reason: data.reason || "Session is revoked or missing." };
      }
      if (
        !data.session.csrfTokenHash ||
        !timingSafeCompareStrings(data.session.csrfTokenHash, expectedCsrfHash)
      ) {
        return { valid: false, reason: "Session CSRF binding mismatch." };
      }
      if (storageMode === "local") {
        const localCheck = verifyDurableAdminSessionInLocalD1(jtiHash);
        if (!localCheck.valid && localCheck.reason === "session_revoked") {
          return { valid: false, reason: "Session revoked in local D1." };
        }
      }
      return { valid: true };
    } catch {
      if (storageMode !== "local") {
        return { valid: false, reason: "Durable session store unreachable (fail-closed)." };
      }
    }
  } else if (storageMode !== "local") {
    return { valid: false, reason: "Durable session store not configured (fail-closed)." };
  }

  const localVerify = verifyDurableAdminSessionInLocalD1(jtiHash);
  if (!localVerify.valid || !localVerify.session) {
    return { valid: false, reason: localVerify.reason || "Session not active in D1." };
  }
  if (!timingSafeCompareStrings(localVerify.session.csrfTokenHash, expectedCsrfHash)) {
    return { valid: false, reason: "Session CSRF binding mismatch." };
  }
  return { valid: true };
}

export async function revokeAdminSessionToken(
  token: string | undefined | null,
  options?: { revokeAllForActor?: boolean; reason?: string }
): Promise<{ revoked: boolean; revokedCount: number }> {
  if (!token || !token.includes(".")) {
    return { revoked: false, revokedCount: 0 };
  }
  let jti = "";
  let actorEmail = "";
  try {
    const [data] = token.split(".");
    if (!data) return { revoked: false, revokedCount: 0 };
    const payload = JSON.parse(
      Buffer.from(data, "base64url").toString("utf-8")
    ) as Partial<AdminSessionPayload>;
    jti = payload.jti || "";
    actorEmail = (payload.email || "").trim().toLowerCase();
  } catch {
    return { revoked: false, revokedCount: 0 };
  }

  if (!jti && !actorEmail) {
    return { revoked: false, revokedCount: 0 };
  }

  const jtiHash = jti ? sha256Hex(jti) : undefined;
  const revokeAllForActor = Boolean(options?.revokeAllForActor);
  const reason = options?.reason || "user_logout";
  const storageMode = getCmsStorageMode();
  const worker = getWorkerConfig();

  let totalRevoked = 0;

  if (storageMode === "local") {
    const localRes = revokeDurableAdminSessionInLocalD1({
      jtiHash,
      actorEmail,
      revokeAllForActor,
      reason
    });
    totalRevoked = Math.max(totalRevoked, localRes.revokedCount);
  }

  if (worker) {
    try {
      const res = await fetch(`${worker.workerBase}/api/v1/admin/auth/sessions`, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${worker.serviceToken}`,
          "X-Actor-Email": actorEmail || "admin"
        },
        body: JSON.stringify({
          action: "revoke",
          jtiHash,
          actorEmail,
          revokeAllForActor,
          reason
        })
      });
      if (res.ok) {
        const data = (await res.json()) as { revokedCount?: number };
        totalRevoked = Math.max(totalRevoked, Number(data.revokedCount || 0));
      }
    } catch {
      // ignore
    }
  }

  return { revoked: true, revokedCount: totalRevoked };
}

export async function verifyAdminSessionToken(
  token: string | undefined | null
): Promise<
  | { status: "valid"; payload: AdminSessionPayload }
  | { status: "unauthorized"; reason: string }
  | { status: "forbidden"; reason: string }
> {
  const sigCheck = decodeAndVerifyAdminSessionTokenSignature(token);
  if (sigCheck.status !== "valid") {
    return sigCheck;
  }

  const durableCheck = await verifyDurableAdminSession(sigCheck.payload);
  if (!durableCheck.valid) {
    return {
      status: "unauthorized",
      reason: `Session invalid or revoked (${durableCheck.reason || "revoked"}).`
    };
  }

  return { status: "valid", payload: sigCheck.payload };
}

export function createSessionPayload(
  email: string,
  name: string,
  mode: AdminSessionPayload["mode"],
  customDurationMs?: number
): AdminSessionPayload {
  const now = Date.now();
  const durationMs =
    typeof customDurationMs === "number" && customDurationMs > 0
      ? customDurationMs
      : Number(process.env.ADMIN_SESSION_TTL_MS || DEFAULT_SESSION_DURATION_MS);

  return {
    jti: crypto.randomUUID(),
    email: email.toLowerCase().trim(),
    name,
    mode,
    iat: now,
    exp: now + durationMs,
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
  const result = await verifyAdminSessionToken(rawToken);
  return result.status === "valid" ? result.payload : null;
}

export const getAdminSession = getServerAdminSession;

/**
 * Computes the strict set of trusted Origins for admin state-changing requests.
 * NEVER reads or trusts client-spoofable X-Forwarded-Host headers.
 */
export function getTrustedAdminOrigins(request: Request): Set<string> {
  const trusted = new Set<string>();

  const configuredList = (
    process.env.ADMIN_TRUSTED_ORIGINS ||
    process.env.ADMIN_ALLOWED_ORIGINS ||
    ""
  )
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  for (const item of configuredList) {
    try {
      trusted.add(new URL(item).origin);
    } catch {
      // ignore invalid URL
    }
  }

  const publicSiteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://keremmihci.com").trim();
  try {
    trusted.add(new URL(publicSiteUrl).origin);
  } catch {
    trusted.add("https://keremmihci.com");
  }

  // Allow loopback origin matching the bound local server URL port (never reads X-Forwarded-Host)
  try {
    const reqUrl = new URL(request.url);
    if (reqUrl.hostname === "127.0.0.1" || reqUrl.hostname === "localhost") {
      const portPart = reqUrl.port ? `:${reqUrl.port}` : "";
      trusted.add(`http://127.0.0.1${portPart}`);
      trusted.add(`http://localhost${portPart}`);
    }
  } catch {
    // ignore
  }

  return trusted;
}

export async function validateTrustedAdminOrigin(
  request: Request
): Promise<{ ok: true } | { ok: false; errorResponse: NextResponse }> {
  const hdrs = await headers();
  const origin = (request.headers.get("origin") || hdrs.get("origin") || "").trim();

  if (!origin) {
    return {
      ok: false,
      errorResponse: NextResponse.json(
        {
          ok: false,
          error: "Forbidden: Missing Origin header on state-changing admin request."
        },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      )
    };
  }

  let parsedOrigin: string;
  try {
    const originUrl = new URL(origin);
    if (originUrl.protocol !== "http:" && originUrl.protocol !== "https:") {
      throw new Error("Invalid protocol");
    }
    parsedOrigin = originUrl.origin;
  } catch {
    return {
      ok: false,
      errorResponse: NextResponse.json(
        { ok: false, error: "Forbidden: Malformed Origin header." },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      )
    };
  }

  const trustedOrigins = getTrustedAdminOrigins(request);
  if (!trustedOrigins.has(parsedOrigin)) {
    return {
      ok: false,
      errorResponse: NextResponse.json(
        {
          ok: false,
          error: `Forbidden: Cross-origin admin mutation rejected (${parsedOrigin} is not a trusted admin origin).`
        },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      )
    };
  }

  return { ok: true };
}

/**
 * Enforces server-side authentication, durable D1 session verification, admin allowlist
 * authorization, CSRF token binding, and strict Trusted Origin verification on every `/api/admin/*` route.
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
  const verification = await verifyAdminSessionToken(rawToken);

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

  // Enforce mandatory CSRF token and Trusted Origin allowlist check on all state-changing requests
  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    const originCheck = await validateTrustedAdminOrigin(request);
    if (!originCheck.ok) {
      return { errorResponse: originCheck.errorResponse };
    }

    const csrfHeader = (request.headers.get("x-csrf-token") || "").trim();
    if (!csrfHeader || !timingSafeCompareStrings(csrfHeader, session.csrfToken)) {
      return {
        errorResponse: NextResponse.json(
          { ok: false, error: "Forbidden: Missing or invalid CSRF token." },
          { status: 403, headers: { "Cache-Control": "no-store" } }
        )
      };
    }
  }

  return { session };
}
