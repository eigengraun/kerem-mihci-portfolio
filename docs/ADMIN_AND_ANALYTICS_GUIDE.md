# Admin Dashboard, GA4 Data API & Google Search Console Guide

## 1. Admin Authentication & Security (`/admin`)

All `/admin` pages and `/api/admin/*` API endpoints enforce server-side authentication (`src/lib/admin/auth.ts`).

### Production Security Controls
- **Fail-Closed Default**: In `CMS_STORAGE_MODE=production`, `staging`, or `NODE_ENV=production`, if `ADMIN_SESSION_SECRET`, `ADMIN_ALLOWED_EMAILS`, and `ADMIN_PASSWORD_HASH` (or Google OAuth credentials) are not configured, `/admin` and `/api/admin/*` automatically deny all access (`503` / `401`). `dev-fixture` bypass is unconditionally disabled in production/staging. Plaintext `ADMIN_MASTER_PASSWORD` and legacy `sha256:` hashes are strictly rejected in production; only cryptographically strong `scrypt:` hashes are accepted.
- **Durable D1 Session Management & Cross-Process Revocation**: Sessions use an HTTP-only, `SameSite=Lax`, `Secure` (in production) cookie (`km_admin_session`) signed with `HMAC-SHA256`, containing `email`, `iat`, `exp`, `csrfToken`, and a unique `jti`. Active and revoked sessions are persisted in Cloudflare D1 (`admin_sessions` table with `jti_hash`), surviving server restarts and synchronizing instantaneously across multiple horizontal server instances. Signing out (`DELETE /api/admin/auth`) records revocation in D1, immediately invalidating replayed tokens across all processes (`401`).
- **Durable Multi-Process Rate Limiting**: Login attempts are tracked in Cloudflare D1 (`admin_rate_limits` table), enforcing a strict 5-attempt threshold with a 15-minute lockout across dual scopes (IP hash and email). Forged `X-Forwarded-For` or `Client-IP` header rotation is blocked by binding rate-limiting to the actor identity and verified socket origin.
- **Identity Allowlist Enforcement (`403`)**: Every request verifies that `session.email` is present in `ADMIN_ALLOWED_EMAILS`, returning `403 Forbidden` for any non-allowlisted identity.
- **CSRF & Same-Origin Verification (`403`)**: All state-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) require a valid `X-CSRF-Token` matching the session's `csrfToken` (timing-safe comparison) and validate the `Origin` header against the host. Forged `X-Forwarded-Host` headers are strictly rejected.
- **Magic-Byte Media Upload Validation & Rollback**: `/api/admin/media` and the Cloudflare Worker `/api/v1/admin/media/upload` inspect binary file headers (`validateMediaFileSignature`) for PNG, JPEG, WebP, GIF, AVIF, MP4, WebM, and script-free SVG, enforce 15 MB image / 100 MB video limits, and roll back the R2 object if D1 metadata insertion fails.
- **Public Media Access Control**: Public `/api/media/[...key]` routes serve assets only if associated with an active `published` project. Unassociated objects, drafts, or deleted projects return HTTP `404` with `Cache-Control: no-store, no-cache, must-revalidate`.
- **Crawler & Analytics Isolation**: `/admin` is disallowed in `/robots.txt`, sends `X-Robots-Tag: noindex, nofollow, noarchive`, and suppresses the public `ConsentBanner` and public GA4 tracking script.

### Required Environment Variables for Admin Auth
```env
CMS_STORAGE_MODE=production
CMS_DATA_SOURCE=cloudflare
CLOUDFLARE_CMS_API_URL=https://kerem-mihci-portfolio-api.<subdomain>.workers.dev
CLOUDFLARE_API_SERVICE_TOKEN=<minimum-32-character-random-secret>
ADMIN_SESSION_SECRET=<minimum-32-character-random-secret>
ADMIN_ALLOWED_EMAILS=kerem@keremmihci.com
ADMIN_PASSWORD_HASH=scrypt:<salt-hex>:<64-byte-derived-key-hex>
```

> **Generating scrypt Password Hash**:
> ```bash
> node -e '
> const crypto = require("node:crypto");
> const pass = process.argv[1] || "your-strong-password";
> const salt = crypto.randomBytes(16).toString("hex");
> const key = crypto.scryptSync(pass, salt, 64, { N: 16384, r: 8, p: 1 });
> console.log(`ADMIN_PASSWORD_HASH=scrypt:${salt}:${key.toString("hex")}`);
> ' "YourPasswordHere"
> ```

---

## 2. Google Analytics 4 Data API Setup

> **Important Distinction**: `NEXT_PUBLIC_GA_MEASUREMENT_ID` (`G-XXXXXXXXXX`) is the public browser stream ID. Server-side reporting via the GA4 Data API (`analyticsdata.googleapis.com/v1beta`) requires the numeric **GA4 Property ID** (`GA4_PROPERTY_ID`, e.g., `481234567`).

### Step 1 — Enable the API in Google Cloud Console
1. Open Google Cloud Console and enable the **Google Analytics Data API**.
2. Create a **Service Account** under **IAM & Admin → Service Accounts** and download its JSON key.

### Step 2 — Grant GA4 Property Access
1. Open **Google Analytics → Admin → Property Settings → Property Access Management**.
2. Add the Service Account's `client_email` with the **Viewer** role.
3. Copy the numeric **Property ID** from **Property Details**.

### Step 3 — Configure Server Environment Variables
```env
GA4_PROPERTY_ID=123456789
GOOGLE_SERVICE_ACCOUNT_EMAIL=portfolio-analytics@<project-id>.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```
*(Alternatively, pass the single-line JSON string in `GOOGLE_SERVICE_ACCOUNT_JSON`.)*

---

## 3. Google Search Console API Setup (`sc-domain:keremmihci.com`)

### Step 1 — Enable the API
1. In Google Cloud Console, enable the **Google Search Console API** (`webmasters.googleapis.com`).

### Step 2 — Grant Search Console Property Permission
1. Open **Google Search Console** for property `keremmihci.com` (`sc-domain:keremmihci.com`).
2. Navigate to **Settings → Users and permissions → Add user**.
3. Add the Service Account's `client_email` with **Restricted** (or **Full**) permission.

### Step 3 — Configure Server Environment Variable
```env
GSC_SITE_URL=sc-domain:keremmihci.com
```

---

## 4. Non-Fabrication Policy
When `GA4_PROPERTY_ID` or Google Service Account credentials are not present in the environment, `/api/admin/analytics` and the `/admin` dashboard explicitly report `status: "NOT_CONFIGURED"` and list the missing environment variables. Zero fake or placeholder visitor numbers are ever rendered.
