# Portfolio OS Phase 6 — Content Governance & Personal Data Protection Policy

**Document Status:** ACTIVE & MANDATORY
**Project:** Kerem Mıhçı Portfolio OS
**Repository:** `eigengraun/kerem-mihci-portfolio`
**Current Governance State:** `OWNER_VERIFICATION_REQUIRED`
**Authoritative Source Reference:** `docs/reviews/PORTFOLIO_OS_PHASE5_2_CONTENT_APPROVAL_CHECKLIST.md`

---

## 1. Governance Principles & Strict Boundaries

1. **Zero Automatic Promotion of Personal Records:**
   Technical source parity (matching `src/data/profile.ts` or local databases) does **NOT** constitute factual verification of a real person's biographical, educational, or career history. All personal details must remain unapproved until signed off by the human owner (Kerem Mıhçı).

2. **Prohibition of Unverified Remote Seeding:**
   Under no circumstances may automated CI/CD runners, AI agents, or deployment scripts remotely seed or publish records into the following tables on staging or production:
   - `portfolio_profile` & `portfolio_profile_translations`
   - `portfolio_experience` & `portfolio_experience_translations`
   - `portfolio_education` & `portfolio_education_translations`
   - `portfolio_skills` & `portfolio_skill_translations`
   - `portfolio_workspace_notes` & `portfolio_workspace_notes_translations`
   - `portfolio_cv_documents` & `portfolio_cv_revisions`

3. **Fail-Closed Presentation:**
   In the absence of explicitly published records, the application must present a clean, fail-closed empty state:
   - **NotesApp Notes Tab:** Shows empty workspace message (`No published notes for "<workspace>" workspace.`).
   - **NotesApp About Tab:** Shows unpopulated indicator (`No published profile is currently available.`).
   - **NotesApp CV Tab:** Displays `CV coming soon` placeholder cards with preview/download disabled.
   - **Public API:** Returns structured HTTP 404 (`PROFILE_NOT_PUBLISHED`, `CV_NOT_PUBLISHED`) with `Cache-Control: no-store` headers.

---

## 2. Authoritative Document Standard

The **ONLY** authorized checklist for content approval is:
[PORTFOLIO_OS_PHASE5_2_CONTENT_APPROVAL_CHECKLIST.md](file:///Volumes/EMIX_WORK/02_DEV/GEMINI/CreativePortfolio/docs/reviews/PORTFOLIO_OS_PHASE5_2_CONTENT_APPROVAL_CHECKLIST.md)

Any manually rewritten summaries or conversational transcripts claiming prior owner approval are strictly non-authoritative.

### Content Field Inventory & Current Status
| Domain | Table | Total Candidate Items | Authenticity Status | Production Gate Decision |
| :--- | :--- | :---: | :---: | :---: |
| **Profile & Bio** | `portfolio_profile` | 1 entity (10 fields) | Verbatim source match | `[ ] OWNER_VERIFICATION_REQUIRED` |
| **Workspace Notes** | `portfolio_workspace_notes` | 24 notes (3 workspaces) | Verbatim source match | `[ ] OWNER_VERIFICATION_REQUIRED` |
| **Experience** | `portfolio_experience` | 5 milestone entries | Verbatim source match | `[ ] OWNER_VERIFICATION_REQUIRED` |
| **Education** | `portfolio_education` | 2 institutional entries | Verbatim source match | `[ ] OWNER_VERIFICATION_REQUIRED` |
| **Skills Catalog** | `portfolio_skills` | 39 items (6 categories) | Verbatim source match | `[ ] OWNER_VERIFICATION_REQUIRED` |
| **Curriculum Vitae** | `portfolio_cv_documents` | 2 documents (TR & EN) | Placeholder (0 bytes) | `[ ] OWNER_VERIFICATION_REQUIRED` |

---

## 3. Production Release Content Gate Runbook

Before any public deployment of personal biographical data occurs:

1. **Owner Review:** The owner must open `PORTFOLIO_OS_PHASE5_2_CONTENT_APPROVAL_CHECKLIST.md` and explicitly mark items as `[x] OWNER_APPROVED` or provide amendments.
2. **Authenticated CMS Ingestion:** Approved items must be entered via the authenticated Studio OS Admin CMS interface (`/admin`) or through an explicitly authorized CLI ingestion with operator confirmation.
3. **Explicit Publication Action:** Items are saved as `draft` by default and must be explicitly transitioned to `published` status via the CMS admin workflow.
4. **Binary CV File Upload:** Authenticated admin must upload valid PDF files (passing magic byte validation `%PDF-`) before public CV links become active.

---

## 4. Current Phase 6 Verification Statement

During Phase 6 testing:
- **0** personal records were written to remote Cloudflare D1 or R2.
- **0** profile, experience, education, skills, or CV records were published to the public staging worker.
- All 16 Phase 5 content tables on remote staging D1 were confirmed strictly empty (`count = 0`).
- The public site gracefully handles this unseeded state across all 5 tested viewports.
