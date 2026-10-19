# Admin Dashboard, GA4 Data API & Google Search Console Guide

## 1. Admin Authentication & Security (`/admin`)

All `/admin` pages and `/api/admin/*` API endpoints enforce server-side authentication (`src/lib/admin/auth.ts`).

### Production Security Controls
- **Fail-Closed Default**: In `NODE_ENV=production`, if `ADMIN_SESSION_SECRET` and `ADMIN_MASTER_PASSWORD` (or Google OAuth credentials) are not configured, `/admin` and `/api/admin/*` automatically deny all access (`503` / `401`).
- **Signed Session Cookie**: Sessions use an HTTP-only, `SameSite=Lax`, `Secure` cookie (`km_admin_session`) signed with `HMAC-SHA256`.
- **CSRF & Same-Origin Verification**: All state-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) verify `X-CSRF-Token` and `Origin` headers.
- **Crawler & Analytics Isolation**: `/admin` is disallowed in `/robots.txt`, sends `X-Robots-Tag: noindex, nofollow, noarchive`, and suppresses the public `ConsentBanner` and public GA4 tracking script.

### Required Environment Variables for Admin Auth
```env
ADMIN_SESSION_SECRET=<minimum-32-character-random-secret>
ADMIN_ALLOWED_EMAILS=kerem@keremmihci.com
ADMIN_MASTER_PASSWORD=<strong-admin-passphrase>
```

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
