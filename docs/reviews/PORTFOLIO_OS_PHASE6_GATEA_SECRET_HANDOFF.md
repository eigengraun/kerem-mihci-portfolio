# Portfolio OS Phase 6 Gate A — Production Service Token Operator Handoff

**Confidentiality Notice:** This document records operational provenance and storage coordinates for the production Cloudflare Worker service token. The literal secret value is cryptographically generated and stored strictly outside the Git repository with restricted POSIX permissions. It is never checked into source control or printed in CI/CD logs.

---

## 1. Secret Identity and Cryptographic Entropy

- **Variable Binding:** `CLOUDFLARE_API_SERVICE_TOKEN`
- **Target Worker Environment:** `kerem-mihci-portfolio-api` (`env.production`)
- **Entropy Generation:** 32 cryptographically secure random bytes via `crypto.randomBytes(32).toString('hex')`
- **Entropy Measure:** 256 bits of CSPRNG entropy
- **Deployment Mechanism:** Atomic deployment via `wrangler deploy --secrets-file <PATH>`

---

## 2. Secure Local Host Filesystem Coordinates

The generated service token is stored in a dedicated, isolated operator directory outside the project root:

- **Directory Path:** `~/.portfolio-production-secrets/gate-a-2026-10-22T16-38-43-598Z/`
- **Directory Permissions:** `0700` (`drwx------`) — accessible only by the current Unix user (`keremmihci`).
- **Secrets File Path:** `~/.portfolio-production-secrets/gate-a-2026-10-22T16-38-43-598Z/secrets.json`
- **File Permissions:** `0600` (`-rw-------`) — read/write only by the current Unix user.

### File Format:
```json
{
  "CLOUDFLARE_API_SERVICE_TOKEN": "[REDACTED_256_BIT_SECRET]"
}
```

---

## 3. Worker Authentication & Usage Guidance

### Live Production API Ingress:
- Base URL: `https://kerem-mihci-portfolio-api.kerem-mihci.workers.dev`

### Authenticated Admin Requests:
When performing future administrative maintenance (such as Gate B content migration once authorized), provide the token in the HTTP `Authorization` header:

```bash
TOKEN=$(jq -r .CLOUDFLARE_API_SERVICE_TOKEN ~/.portfolio-production-secrets/gate-a-2026-10-22T16-38-43-598Z/secrets.json)

curl -X GET "https://kerem-mihci-portfolio-api.kerem-mihci.workers.dev/api/v1/admin/projects" \
  -H "Authorization: Bearer ${TOKEN}"
```

### Fail-Closed Safeguards:
- Requests without `Authorization` header return `401 Unauthorized` (`"Missing Bearer service token."`).
- Requests with invalid tokens return `401 Unauthorized` (`"Invalid service token."`).
- Requests to `/api/v1/admin/seed` in production return `403 Forbidden` (`"Canonical seed endpoint is disabled via ALLOW_CANONICAL_SEED=false."`).

---

## 4. Key Rotation & Revocation Protocol

Should this service token need rotation:
1. Generate a new 32-byte secret in a new timestamped folder under `~/.portfolio-production-secrets/`.
2. Redeploy the production Worker with `npx wrangler deploy --config cloudflare/portfolio-api/wrangler.jsonc --env production --secrets-file <NEW_SECRETS_FILE>`.
3. Cloudflare Worker atomically updates the encrypted secret binding in runtime memory.
4. Archive or securely shred the old secret file.
