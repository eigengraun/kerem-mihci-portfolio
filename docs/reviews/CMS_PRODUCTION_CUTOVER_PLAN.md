# Cloudflare CMS Production Cutover & Rollback Plan

> [!CAUTION]
> **Production Cutover Safety Scope**
> Live production (`https://keremmihci.com`) hosted on Hostinger (`main` branch) is currently running on static canonical files.
> No production Cloudflare resources (`kerem-mihci-portfolio-api`, `kerem-portfolio-db`, `kerem-portfolio-media`) will be created or modified until explicit user review and authorization.
> This cutover plan defines the verified, lossless, zero-downtime deployment procedure.

---

## 1. Canonical Production Resource Naming

| Resource | Environment | Canonical Production Name | Status |
| :--- | :--- | :--- | :--- |
| **Cloudflare Worker** | Staging | `kerem-mihci-portfolio-api-staging` | **ACTIVE & VERIFIED** |
| **Cloudflare Worker** | Production | `kerem-mihci-portfolio-api` | *Pending Cutover* |
| **D1 Database** | Staging | `kerem-portfolio-db-staging` | **ACTIVE & VERIFIED (30 Projects)** |
| **D1 Database** | Production | `kerem-portfolio-db` | *Pending Cutover* |
| **R2 Media Bucket** | Staging | `kerem-portfolio-media-staging` | **ACTIVE & VERIFIED** |
| **R2 Media Bucket** | Production | `kerem-portfolio-media` | *Pending Cutover* |

---

## 2. Pre-Cutover Verification Checklist

Before initiating production cutover, ensure the following prerequisites are met:
- [x] Staging D1 database contains 30 canonical projects matching `main` 100%.
- [x] Zero-destructive runtime DDL verified across all Worker endpoints.
- [x] Public media access control and cache policy verified (404 on drafts/orphans, 200 on published).
- [x] Durable D1 admin sessions and scrypt authentication verified.
- [x] Durable D1 rate limiting verified across horizontal processes.
- [x] 13/13 Remote Staging E2E tests passed cleanly.
- [x] 9/9 D1 failure resilience tests passed cleanly.
- [x] 11/11 Security and outage hardening tests passed cleanly.
- [ ] User provides explicit approval to provision production Cloudflare infrastructure.

---

## 3. Phase 1 — Provisioning Production Cloudflare Infrastructure

Once authorized, execute the following commands to provision canonical production resources:

### Step 1.1 — Create the Production D1 Database
```bash
cd cloudflare/portfolio-api
npx wrangler d1 create kerem-portfolio-db
```
*Note the returned `database_id` and update `cloudflare/portfolio-api/wrangler.jsonc` under `env.production.d1_databases[0].database_id`.*

### Step 1.2 — Apply Versioned Production Migrations
```bash
npx wrangler d1 migrations apply kerem-portfolio-db --env production --remote
```
*Applies `0001_initial_schema.sql` and `0002_durable_admin_auth.sql` to production D1.*

### Step 1.3 — Create the Production R2 Media Bucket
```bash
npx wrangler r2 bucket create kerem-portfolio-media
```

### Step 1.4 — Set Production Worker Service Token
Generate a cryptographically secure 64-character secret and assign it to the production Worker:
```bash
npx wrangler secret put CLOUDFLARE_API_SERVICE_TOKEN --env production
```

### Step 1.5 — Deploy the Production Cloudflare Worker
```bash
npx wrangler deploy --env production
```
*The Worker URL will be: `https://kerem-mihci-portfolio-api.<subdomain>.workers.dev`.*

### Step 1.6 — Seed Canonical 30 Projects to Production D1
```bash
CLOUDFLARE_CMS_API_URL=https://kerem-mihci-portfolio-api.<subdomain>.workers.dev \
CLOUDFLARE_API_SERVICE_TOKEN=<your-production-service-token> \
npm run cms:migrate
```
*Verify that `https://kerem-mihci-portfolio-api.<subdomain>.workers.dev/api/v1/public/health` returns `publishedCount: 30`.*

---

## 4. Phase 2 — Hostinger Next.js Cutover Execution

### Step 2.1 — Generate Production scrypt Password Hash
Run on your local terminal to hash your admin master password:
```bash
node -e '
const crypto = require("node:crypto");
const pass = "YourStrongAdminPasswordHere";
const salt = crypto.randomBytes(16).toString("hex");
const key = crypto.scryptSync(pass, salt, 64, { N: 16384, r: 8, p: 1 });
console.log(`ADMIN_PASSWORD_HASH=scrypt:${salt}:${key.toString("hex")}`);
'
```

### Step 2.2 — Update Hostinger Environment Variables
In the Hostinger Node.js Application Manager or `.env` file, configure:
```env
# CMS Runtime Mode
CMS_STORAGE_MODE=production
CMS_DATA_SOURCE=cloudflare

# Cloudflare Worker API Connection
CLOUDFLARE_CMS_API_URL=https://kerem-mihci-portfolio-api.<subdomain>.workers.dev
CLOUDFLARE_API_SERVICE_TOKEN=<production-service-token>

# Admin Authentication & Security
ADMIN_SESSION_SECRET=<random-64-character-hex-secret>
ADMIN_ALLOWED_EMAILS=kerem@keremmihci.com
ADMIN_PASSWORD_HASH=scrypt:<salt>:<hash>

# Optional Google Analytics & Search Console
GA4_PROPERTY_ID=<numeric-property-id>
GOOGLE_SERVICE_ACCOUNT_EMAIL=<service-account-email>
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="<private-key>"
GSC_SITE_URL=sc-domain:keremmihci.com
```

### Step 2.3 — Merge & Deploy Feature Branch to Main
1. Open Pull Request from `feature/cloudflare-cms-dashboard` to `main`.
2. Merge PR into `main`.
3. Trigger deployment on Hostinger (or `git pull origin main && npm run build && pm2 reload all`).

### Step 2.4 — Post-Cutover Sanity Verification
1. Open `https://keremmihci.com/api/projects` → verify `count: 30` and `source: "cloudflare"`.
2. Open `https://keremmihci.com/admin` → verify secure login via scrypt password.
3. Verify public media and project detail routes (`/tr/project/fling-arena`, `/en/project/fling-arena`).

---

## 5. Phase 3 — Zero-Downtime Lossless Rollback Plan

If any unforeseen network or Cloudflare service degradation occurs post-cutover, execute this instant rollback:

### Immediate Rollback (0 Code Changes Required)
Change a single environment variable on Hostinger:
```env
CMS_DATA_SOURCE=legacy
```
Restart Next.js (`pm2 reload all` or restart app in Hostinger panel).

### Rollback Effect
- Public visitors are instantly routed back to static compiled files in `src/data/projects.ts` (`0ms` data loss, zero dependency on Cloudflare network).
- `/admin` remains accessible or can be temporarily disabled by setting `CMS_STORAGE_MODE=local`.
- No user content or database state is destroyed.
