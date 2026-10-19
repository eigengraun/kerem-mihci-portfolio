# Google Analytics 4 & Search Console Setup & Integration Guide

> [!IMPORTANT]
> **Production Policy: Strict Non-Fabrication of Metrics**
> The Portfolio OS analytics subsystem (`/api/admin/analytics` and `/admin`) strictly enforces **zero mock or fabricated visitor data**.
> When credentials or property IDs are not configured in the server environment, the API explicitly returns `status: "NOT_CONFIGURED"` and details the missing configuration. No fake visitor counts, mock graphs, or synthetic charts are ever generated.

---

## 1. Architecture & Credential Separation

The Portfolio OS implements a clean separation between **public browser-side event collection** and **authenticated server-side analytics reporting**:

```mermaid
flowchart TD
    subgraph Browser ["Public Client (Visitor Browser)"]
        PublicTag["gtag.js / GA4 Script<br/>NEXT_PUBLIC_GA_MEASUREMENT_ID<br/>(e.g., G-XXXXXXXXXX)"]
    end

    subgraph GoogleCloud ["Google Cloud & Analytics Platform"]
        DataStream["GA4 Web Data Stream"]
        GA4Property["GA4 Property<br/>GA4_PROPERTY_ID (Numeric)"]
        GSCProperty["Search Console Property<br/>sc-domain:keremmihci.com"]
        DataAPI["analyticsdata.googleapis.com/v1beta"]
        SearchAPI["searchconsole.googleapis.com/v1"]
    end

    subgraph AdminDashboard ["Portfolio OS Admin Dashboard (/admin)"]
        AdminAPI["/api/admin/analytics"]
        ServiceAccount["Google Cloud Service Account<br/>(Client Email & Private Key)"]
    end

    PublicTag -- "Sends page views & clicks" --> DataStream
    DataStream --> GA4Property
    AdminAPI -- "Authenticates via JWT" --> ServiceAccount
    ServiceAccount -- "Queries aggregated metrics" --> DataAPI
    ServiceAccount -- "Queries search clicks & impressions" --> SearchAPI
    DataAPI --> GA4Property
    SearchAPI --> GSCProperty
```

---

## 2. Key Differences: Measurement ID vs Numeric Property ID

| Identifier | Format | Where Configured | Purpose |
| :--- | :--- | :--- | :--- |
| **Measurement ID** | `G-XXXXXXXXXX` | Public Environment: `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Included in public client HTML to send page views and events from visitors. **Cannot query the Data API.** |
| **Numeric Property ID** | `123456789` (Numeric only) | Server Secret: `GA4_PROPERTY_ID` | Required by the GA4 Data API (`properties/<id>:runReport`) to query server-side analytics. |
| **GSC Site URL** | `sc-domain:keremmihci.com` | Server Secret: `GSC_SITE_URL` | Identifies the Domain Property in Google Search Console. |

---

## 3. Step-by-Step Provisioning Instructions

### Step 1 — Create a Google Cloud Project & Enable APIs
1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g., `kerem-mihci-portfolio`).
3. Enable the two required APIs:
   - **Google Analytics Data API** (`analyticsdata.googleapis.com`)
   - **Google Search Console API** (`searchconsole.googleapis.com` or `webmasters.googleapis.com`)

### Step 2 — Create a Service Account & Download Key
1. In Google Cloud Console, navigate to **IAM & Admin → Service Accounts**.
2. Click **Create Service Account**:
   - Name: `portfolio-analytics`
   - Description: `Server-side analytics client for Portfolio OS admin`
3. Click **Create and Continue** (no project-level roles are required).
4. Select the newly created service account and navigate to the **Keys** tab.
5. Click **Add Key → Create new key**, select **JSON**, and save the downloaded file securely.
6. Note the `client_email` (e.g., `portfolio-analytics@<project-id>.iam.gserviceaccount.com`).

### Step 3 — Grant Access in Google Analytics 4
1. Open [Google Analytics](https://analytics.google.com/).
2. Select your property (`keremmihci.com`).
3. In the lower-left corner, click **Admin (gear icon)**.
4. Under **Property**, click **Property Access Management**.
5. Click the **+** button in the top right → **Add users**.
6. Enter the service account `client_email` from Step 2.
7. Assign the **Viewer** role.
8. Navigate to **Property Details** and copy the numeric **Property ID** (e.g., `481234567`).

### Step 4 — Grant Access in Google Search Console
1. Open [Google Search Console](https://search.google.com/search-console).
2. Select the property `sc-domain:keremmihci.com`.
3. In the left sidebar, click **Settings → Users and permissions**.
4. Click **Add user**.
5. Enter the service account `client_email` from Step 2.
6. Set permission to **Restricted** (sufficient for reading search performance data).
7. Confirm the property URL string is `sc-domain:keremmihci.com`.

---

## 4. Environment Variables Configuration

### Production (Hostinger) Environment
Add the following variables to your production `.env` (or Hostinger Environment Configuration):

```env
# Google Analytics 4 Data API
GA4_PROPERTY_ID=123456789
GOOGLE_SERVICE_ACCOUNT_EMAIL=portfolio-analytics@<project-id>.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Google Search Console API
GSC_SITE_URL=sc-domain:keremmihci.com
```

*(Alternatively, you can provide the entire JSON file as a single line in `GOOGLE_SERVICE_ACCOUNT_JSON`.)*

---

## 5. Required OAuth Scopes (Implemented in Code)

The Portfolio OS analytics client (`src/lib/admin/googleAnalyticsAndGsc.ts`) requests strictly read-only scopes:
- `https://www.googleapis.com/auth/analytics.readonly`
- `https://www.googleapis.com/auth/webmasters.readonly`

---

## 6. Pre-Production Verification Status

- The analytics endpoint `/api/admin/analytics` and admin dashboard `/admin` have been tested against missing environment variables.
- Verified behavior: When `GA4_PROPERTY_ID` or Service Account credentials are not present:
  - The endpoint returns HTTP `200` with `status: "NOT_CONFIGURED"`.
  - Zero placeholder or fake numbers are displayed.
  - The UI clearly indicates "Google Analytics & Search Console Not Configured" with setup guidance.
- Upon configuration of the environment variables in production, `/api/admin/analytics` immediately begins serving live 7-day and 30-day visitor sessions, page views, bounce rates, top referrers, and search queries.
