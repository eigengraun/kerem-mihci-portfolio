import { NextResponse } from "next/server";
import { requireAdminApiAuth, getAdminAuthConfigStatus } from "@/lib/admin/auth";
import {
  getD1HealthAndStats,
  reconcileCanonicalProjectsWithD1,
  listAuditLogsFromD1,
  listPublishingEventsFromD1
} from "@/lib/portfolio/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdminApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  const d1Health = getD1HealthAndStats();
  const reconciliation = reconcileCanonicalProjectsWithD1();
  const auditLogs = listAuditLogsFromD1(40);
  const publishingEvents = listPublishingEventsFromD1(40);
  const authConfig = getAdminAuthConfigStatus();

  return NextResponse.json(
    {
      ok: true,
      d1Health,
      reconciliation,
      auditLogs,
      publishingEvents,
      authConfig,
      environment: {
        nodeEnv: process.env.NODE_ENV || "development",
        gaMeasurementIdConfigured: Boolean(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID),
        ga4PropertyIdConfigured: Boolean(process.env.GA4_PROPERTY_ID),
        googleServiceAccountConfigured: Boolean(
          process.env.GOOGLE_SERVICE_ACCOUNT_JSON ||
            (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
              process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)
        ),
        gscSiteUrl: process.env.GSC_SITE_URL || "sc-domain:keremmihci.com",
        cloudflareRemoteWorkerConfigured: Boolean(
          process.env.CLOUDFLARE_CMS_API_URL && process.env.CLOUDFLARE_API_SERVICE_TOKEN
        )
      }
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
