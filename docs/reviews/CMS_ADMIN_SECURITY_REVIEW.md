# CMS Admin Security & Outage Consistency Review

> [!IMPORTANT]
> Verified on isolated feature branch `feature/cloudflare-cms-dashboard`. All server-side session revocation, rate limiting, CSRF/Origin enforcement, `scrypt` password hashing, Worker seed gating, R2 media rollback, and Worker outage snapshot consistency controls have been tested across multiple independent Node.js processes (`:3099`, `:3100`, `:3101`) and process restarts.

## 1. Durable Server-Side Admin Session Store (`admin_sessions`)

- **Previous Discrepancy Fixed**: Removed the process-local `const revokedSessionJtis = new Set<string>()` from [`src/lib/admin/auth.ts`](file:///Volumes/EMIX_WORK/02_DEV/GEMINI/CreativePortfolio/src/lib/admin/auth.ts).
- **Schema (`cloudflare/portfolio-api/migrations/0001_initial_schema.sql`)**:
  - `jti_hash TEXT PRIMARY KEY` (SHA-256 hex digest of `payload.jti`; raw session tokens are never stored in D1)
  - `actor_email TEXT NOT NULL`
  - `role TEXT NOT NULL DEFAULT 'owner'`
  - `csrf_token_hash TEXT NOT NULL` (SHA-256 hex digest of `payload.csrfToken`)
  - `issued_at INTEGER NOT NULL`
  - `expires_at INTEGER NOT NULL`
  - `revoked_at INTEGER`
  - `revoked_reason TEXT`
  - `ip_hash TEXT`
  - `user_agent TEXT`
  - `last_seen_at INTEGER NOT NULL`
- **Verification Flow (`verifyAdminSessionToken`)**:
  1. Verifies HMAC-SHA256 signature and payload claims (`jti`, `csrfToken`, `exp`) in constant time.
  2. Verifies `payload.email` against `ADMIN_ALLOWED_EMAILS`.
  3. Queries D1 (`admin_sessions` via `/api/v1/admin/auth/sessions` in Worker mode or `.local-d1/portfolio.sqlite` in local mode) by `jti_hash`:
     - Rejects if row does not exist (`session_not_found`).
     - Rejects if `revoked_at IS NOT NULL` (`session_revoked`).
     - Rejects if `expires_at <= nowSec` (`session_expired`).
     - Rejects if `csrf_token_hash` or `actor_email` does not match in constant time.
- **Revocation Modes (`DELETE /api/admin/auth`)**:
  - **Single-Session Logout**: Sets `revoked_at` and `revoked_reason = 'user_logout'` on `WHERE jti_hash = ?`.
  - **Global Logout (`DELETE /api/admin/auth?all=true`)**: Sets `revoked_at` and `revoked_reason = 'global_logout'` on `WHERE LOWER(actor_email) = LOWER(?) AND revoked_at IS NULL`, immediately invalidating all active sessions for that administrator across all devices and Node processes.

## 2. Durable Login Rate Limiting & Forged Proxy Header Resistance (`admin_rate_limits`)

- **Previous Discrepancy Fixed**: Removed the process-local `const loginRateLimitStore = new Map()` from [`src/lib/admin/auth.ts`](file:///Volumes/EMIX_WORK/02_DEV/GEMINI/CreativePortfolio/src/lib/admin/auth.ts).
- **Trusted Proxy IP Extraction (`extractTrustedClientIp`)**:
  - `X-Forwarded-For`, `CF-Connecting-IP`, and `X-Real-IP` are **ignored by default**.
  - Forwarded client IP headers are only read when `TRUSTED_PROXY_SHARED_SECRET` is configured on the server and the incoming request supplies a matching `x-trusted-proxy-secret` header verified in constant time.
  - Without a verified proxy secret, all direct requests map to the non-spoofable `"untrusted-direct-peer"` bucket, preventing attackers from rotating `X-Forwarded-For` headers to bypass rate limiting.
- **Dual-Scope Rate Limiting**:
  - Every login attempt is checked and recorded against two independent D1 keys in `admin_rate_limits`:
    - `ip:<sha256(trustedIp)>`
    - `acct:<sha256(normalizedTargetEmail)>`
  - **Policy**: Maximum `5` failed attempts within a `15-minute` window triggers a `15-minute` lockout (`HTTP 429` with `Retry-After` header).
  - **Bounded Storage**: Automatically prunes expired rows (`updated_at < now - 86400`) and caps `admin_rate_limits` at `1000` rows.

## 3. Password Security (`scrypt`) & User-Verified Admin Identity

- **Production Password Policy**:
  - In `CMS_STORAGE_MODE=production`, plaintext `ADMIN_MASTER_PASSWORD` and legacy `sha256:` hashes are **rejected**.
  - Only `ADMIN_PASSWORD_HASH` (or `ADMIN_MASTER_PASSWORD_HASH`) formatted as `scrypt:<16-byte-salt-hex>:<64-byte-derived-key-hex>` and verified via `crypto.scryptSync` + `crypto.timingSafeEqual` is accepted in production.
  - Offline CLI generator provided at [`scripts/hash-admin-password.mjs`](file:///Volumes/EMIX_WORK/02_DEV/GEMINI/CreativePortfolio/scripts/hash-admin-password.mjs).
- **Admin Identity Policy**:
  - In `CMS_STORAGE_MODE=production`, `ADMIN_ALLOWED_EMAILS` must be explicitly configured by the operator. No default email is assumed when `ADMIN_ALLOWED_EMAILS` is unset.

## 4. CSRF & Strict Trusted-Origin Enforcement (`validateTrustedAdminOrigin`)

- **Previous Discrepancy Fixed**: `validateTrustedAdminOrigin` in [`src/lib/admin/auth.ts`](file:///Volumes/EMIX_WORK/02_DEV/GEMINI/CreativePortfolio/src/lib/admin/auth.ts) **never** reads `X-Forwarded-Host` or `X-Forwarded-Proto`.
- **Enforcement**:
  - Every state-changing request (`POST`, `PUT`, `PATCH`, `DELETE`) to `/api/admin/*` must provide:
    1. A valid `Origin` header whose parsed `new URL(origin).origin` is in `getTrustedAdminOrigins()` (`NEXT_PUBLIC_SITE_URL`, `ADMIN_TRUSTED_ORIGINS`, or bound loopback port).
    2. A valid `x-csrf-token` header matching the session's `csrfToken` in constant time.
  - Forged `X-Forwarded-Host: evil.example` + `Origin: https://evil.example`, missing `Origin`, malformed `Origin`, missing `x-csrf-token`, or invalid `x-csrf-token` all deterministically return `403 Forbidden`.

## 5. Worker Seed Endpoint Protection (`POST /api/v1/admin/seed`)

- Requires `Authorization: Bearer <CLOUDFLARE_API_SERVICE_TOKEN>` (`401` if missing or invalid).
- Disabled when `ALLOW_CANONICAL_SEED === "false"` (`403 Forbidden`, default in production environment config).
- Automatically sets `canonical_seed_locked = { locked: true }` in `site_settings` after initial migration; subsequent calls return `409 Conflict`.
- Refuses `upsertExisting: true` with `409 Conflict` if any non-seed editorial revision (`action != 'seed_migration'`) exists in `project_revisions`.

## 6. Public Snapshot Outage Consistency Policy (`src/lib/portfolio/repository.ts`)

- **Coordinated Tombstone Ledger + Bounded Snapshot TTL**:
  - Whenever a project is unpublished (`draft`), archived (`archived`), or deleted, a tombstone entry (`slug:<slug>`) and monotonic `cms_publication_version` are recorded in D1 (`site_settings`) and in-memory.
  - During a Cloudflare Worker outage, warm Node processes serve `lastKnownPublishedSnapshot` (bounded by a 5-minute TTL) filtered against the tombstone ledger and synchronized across processes via `.local-d1/portfolio.sqlite`, ensuring unpublished/archived/deleted projects **never** reappear on any process (`404` on `/[locale]/project/[slug]`, excluded from `/api/projects` and `/sitemap.xml`).
  - Cold-start Node processes launched during a Worker outage with no warm snapshot return `HTTP 503` (`X-Portfolio-Snapshot-State: degraded-cold-start-outage`) on `/api/projects` and **never** silently fall back to `src/data/projects.ts`.

## 7. Media Lifecycle & Deterministic ID Collision Immunity

- **Issue Diagnosed**: In earlier iterations, `projects` table had `ON DELETE SET NULL` on `project_media.project_id`. When a project was deleted and re-created with the same ID, deterministic gallery media IDs (`${projectId}-media-${i + 1}`) caused `SQLITE_CONSTRAINT_PRIMARYKEY` collisions against the orphaned media records.
- **Fix Implemented in Worker & Local Engine**:
  - `DELETE /api/v1/admin/projects/:id` in `cloudflare/portfolio-api/src/index.ts` and `src/lib/portfolio/d1Engine.ts` explicitly deletes derived gallery media references (`DELETE FROM project_media WHERE project_id = ? AND kind = 'gallery'`). Uploaded library assets retain `ON DELETE SET NULL` semantics.
  - Project upsert sweeps any existing orphaned gallery rows matching `${projectId}-media-N` where `project_id IS NULL`, and checks if any other project owns the ID (returning `409 Conflict` instead of `500 Internal Server Error`).
- **R2 Media Rollback**:
  - In Worker media uploads (`POST /api/v1/admin/media/upload`), if subsequent D1 record insertion fails, or if a non-existent project was targeted, the uploaded R2 object is immediately deleted via `bucket.delete(customStorageKey)`. Verified with HTTP 404 assertions on the rolled-back object key.

## 8. Verified Hardening Suite Results (`scripts/verify-security-and-outage-hardening.mjs`)

| Stage | Verification Scope | Status |
|---|---|---|
| Step 1 | Offline `scrypt` password hash CLI generator (`scripts/hash-admin-password.mjs`) | **PASS** |
| Step 2 | Cloudflare Worker startup on `:8787` (`GET /api/v1/public/health`) | **PASS** |
| Step 3 | Production fail-closed password & allowed-emails enforcement (`:3102`) | **PASS** |
| Step 4 | Multi-process Next.js startup on `:3099` and `:3100` with `scrypt` auth | **PASS** |
| Step 5 | Durable admin session revocation, process restart survival & global logout | **PASS** |
| Step 6 | Durable login rate limiting (5 attempts / 15m), cross-process & header spoofing | **PASS** |
| Step 7 | CSRF token and strict trusted origin validation matrix (rejects evil origin, forged host) | **PASS** |
| Step 8 | Worker seed endpoint protection (`401` unauth/invalid token, `409` when locked) | **PASS** |
| Step 9 | R2 media validation (rejects SVG/invalid MIME, rolls back R2 on failure, `409` duplicate key) | **PASS** |
| Step 10 | Complete CMS publishing E2E suite, sitemap unpublish removal & responsive QA | **PASS** |
| Step 11 | Worker outage snapshot consistency, tombstone synchronization & cold-start 503 | **PASS** |
