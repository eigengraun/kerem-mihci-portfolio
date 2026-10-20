import { NextResponse } from "next/server";
import { requireAdminApiAuth, getAdminAuthConfigStatus } from "@/lib/admin/auth";
import {
  getCmsDataSource,
  getCmsStorageMode,
  getD1HealthAndStats,
  reconcileCanonicalProjectsWithD1,
  listAuditLogsFromD1,
  listPublishingEventsFromD1
} from "@/lib/portfolio/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdminApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  const d1Health = await getD1HealthAndStats();
  let reconciliation: Awaited<ReturnType<typeof reconcileCanonicalProjectsWithD1>> = {
    checkCompleted: false,
    status: "unexecuted",
    canonicalCount: 30,
    d1TotalCount: 0,
    missingSlugs: [],
    nonCanonicalSlugs: [],
    fieldMismatches: [],
    reconciled: false,
    error: "Reconciliation not yet executed"
  };
  let auditLogs: Awaited<ReturnType<typeof listAuditLogsFromD1>> = [];
  let publishingEvents: Awaited<ReturnType<typeof listPublishingEventsFromD1>> = [];

  try {
    [reconciliation, auditLogs, publishingEvents] = await Promise.all([
      reconcileCanonicalProjectsWithD1(),
      listAuditLogsFromD1(40),
      listPublishingEventsFromD1(40)
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/admin/system] System check encountered an error:", err);
    reconciliation = {
      checkCompleted: false,
      status: "unexecuted",
      canonicalCount: 30,
      d1TotalCount: 0,
      missingSlugs: [],
      nonCanonicalSlugs: [],
      fieldMismatches: [],
      reconciled: false,
      error: `System check execution error: ${message}`
    };
  }

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
        storageMode: getCmsStorageMode(),
        dataSource: getCmsDataSource(),
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
