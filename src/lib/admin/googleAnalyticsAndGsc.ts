import crypto from "node:crypto";
import type { CmsProjectRecord } from "@/lib/portfolio/types";

export type AnalyticsDateRange = "7d" | "28d" | "90d";

export interface Ga4ReportData {
  status: "LIVE" | "NOT_CONFIGURED" | "ERROR";
  propertyId: string | null;
  measurementId: string | null;
  missingEnvVars: string[];
  errorMessage?: string;
  fetchedAt: string;
  dateRange: AnalyticsDateRange;
  realtimeActiveUsers: number | null;
  overview: {
    activeUsers: number;
    totalUsers: number;
    newUsers: number;
    sessions: number;
    screenPageViews: number;
    engagedSessions: number;
    engagementRate: number;
    averageSessionDuration: number;
  } | null;
  dailySeries: {
    date: string;
    activeUsers: number;
    sessions: number;
    pageViews: number;
  }[];
  topPages: {
    pagePath: string;
    pageTitle: string;
    views: number;
    users: number;
    avgDuration: number;
    engagementRate: number;
  }[];
  sources: {
    source: string;
    medium: string;
    sessions: number;
    users: number;
  }[];
  devices: {
    deviceCategory: string;
    users: number;
    sessions: number;
  }[];
  countries: {
    country: string;
    city: string;
    users: number;
    sessions: number;
  }[];
  events: {
    eventName: string;
    eventCount: number;
  }[];
}

export interface GscReportData {
  status: "LIVE" | "NOT_CONFIGURED" | "ERROR";
  siteUrl: string;
  missingEnvVars: string[];
  errorMessage?: string;
  fetchedAt: string;
  dateRange: AnalyticsDateRange;
  totals: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  } | null;
  dailySeries: {
    date: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }[];
  queries: {
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }[];
  pages: {
    page: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }[];
  devices: {
    device: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }[];
  countries: {
    country: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }[];
}

export interface ProjectTrafficInsight {
  projectId: string;
  slug: string;
  titleTR: string;
  titleEN: string;
  workspace: string;
  status: string;
  featured: boolean;
  ga4: {
    totalViews: number | null;
    trViews: number | null;
    enViews: number | null;
    users: number | null;
    avgDuration: number | null;
  };
  gsc: {
    clicks: number | null;
    impressions: number | null;
    ctr: number | null;
    position: number | null;
  };
}

// 10-minute server-side cache
const CACHE_TTL_MS = 10 * 60 * 1000;
const reportCache = new Map<string, { expiresAt: number; data: unknown }>();

function getDaysCount(range: AnalyticsDateRange): number {
  if (range === "7d") return 7;
  if (range === "90d") return 90;
  return 28;
}

function formatIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function resolveServiceAccountCredentials(): {
  clientEmail: string;
  privateKey: string;
} | null {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      const parsed = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON) as {
        client_email?: string;
        private_key?: string;
      };
      if (parsed.client_email && parsed.private_key) {
        return {
          clientEmail: parsed.client_email,
          privateKey: parsed.private_key.replace(/\\n/g, "\n")
        };
      }
    } catch {
      // fall through
    }
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (email && key) {
    return {
      clientEmail: email.trim(),
      privateKey: key.replace(/\\n/g, "\n")
    };
  }

  return null;
}

async function getGoogleAccessToken(scopes: string[]): Promise<string> {
  // Option 1: OAuth2 Refresh Token if configured
  if (
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
    process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
    process.env.GOOGLE_OAUTH_REFRESH_TOKEN
  ) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
        client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
        refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
        grant_type: "refresh_token"
      })
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Google OAuth token exchange failed (${res.status}): ${text}`);
    }
    const json = (await res.json()) as { access_token: string };
    return json.access_token;
  }

  // Option 2: Service Account JWT
  const sa = resolveServiceAccountCredentials();
  if (!sa) {
    throw new Error("Missing Google Service Account or OAuth Refresh Token credentials.");
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const claimSet = Buffer.from(
    JSON.stringify({
      iss: sa.clientEmail,
      scope: scopes.join(" "),
      aud: "https://oauth2.googleapis.com/token",
      iat: nowSec,
      exp: nowSec + 3600
    })
  ).toString("base64url");

  const unsignedJwt = `${header}.${claimSet}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsignedJwt);
  const signature = signer.sign(sa.privateKey, "base64url");
  const assertion = `${unsignedJwt}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Service Account JWT token exchange failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

interface Ga4ApiRow {
  dimensionValues?: { value?: string }[];
  metricValues?: { value?: string }[];
}

interface Ga4ApiResponse {
  rows?: Ga4ApiRow[];
}

async function runGa4Report(
  propertyId: string,
  accessToken: string,
  body: Record<string, unknown>
): Promise<Ga4ApiResponse> {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(
    propertyId
  )}:runReport`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GA4 runReport error (${res.status}): ${errText}`);
  }
  return (await res.json()) as Ga4ApiResponse;
}

export async function fetchGa4Analytics(
  dateRange: AnalyticsDateRange = "28d"
): Promise<Ga4ReportData> {
  const propertyId = process.env.GA4_PROPERTY_ID?.trim() || null;
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || null;
  const sa = resolveServiceAccountCredentials();
  const hasOAuthRefresh = Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
      process.env.GOOGLE_OAUTH_REFRESH_TOKEN
  );

  const missingEnvVars: string[] = [];
  if (!propertyId) missingEnvVars.push("GA4_PROPERTY_ID");
  if (!sa && !hasOAuthRefresh) {
    missingEnvVars.push("GOOGLE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
  }

  if (missingEnvVars.length > 0 || !propertyId) {
    return {
      status: "NOT_CONFIGURED",
      propertyId,
      measurementId,
      missingEnvVars,
      fetchedAt: new Date().toISOString(),
      dateRange,
      realtimeActiveUsers: null,
      overview: null,
      dailySeries: [],
      topPages: [],
      sources: [],
      devices: [],
      countries: [],
      events: []
    };
  }

  const cacheKey = `ga4:${propertyId}:${dateRange}`;
  const cached = reportCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data as Ga4ReportData;
  }

  try {
    const accessToken = await getGoogleAccessToken([
      "https://www.googleapis.com/auth/analytics.readonly"
    ]);
    const days = getDaysCount(dateRange);
    const dateRanges = [{ startDate: `${days}daysAgo`, endDate: "today" }];

    const [
      overviewRes,
      dailyRes,
      pagesRes,
      sourcesRes,
      devicesRes,
      countriesRes,
      eventsRes,
      realtimeRes
    ] = await Promise.all([
      runGa4Report(propertyId, accessToken, {
        dateRanges,
        metrics: [
          { name: "activeUsers" },
          { name: "totalUsers" },
          { name: "newUsers" },
          { name: "sessions" },
          { name: "screenPageViews" },
          { name: "engagedSessions" },
          { name: "engagementRate" },
          { name: "averageSessionDuration" }
        ]
      }),
      runGa4Report(propertyId, accessToken, {
        dateRanges,
        dimensions: [{ name: "date" }],
        metrics: [
          { name: "activeUsers" },
          { name: "sessions" },
          { name: "screenPageViews" }
        ],
        orderBys: [{ dimension: { dimensionName: "date" } }]
      }),
      runGa4Report(propertyId, accessToken, {
        dateRanges,
        dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
        metrics: [
          { name: "screenPageViews" },
          { name: "activeUsers" },
          { name: "averageSessionDuration" },
          { name: "engagementRate" }
        ],
        limit: 100
      }),
      runGa4Report(propertyId, accessToken, {
        dateRanges,
        dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }],
        metrics: [{ name: "sessions" }, { name: "activeUsers" }],
        limit: 25
      }),
      runGa4Report(propertyId, accessToken, {
        dateRanges,
        dimensions: [{ name: "deviceCategory" }],
        metrics: [{ name: "activeUsers" }, { name: "sessions" }]
      }),
      runGa4Report(propertyId, accessToken, {
        dateRanges,
        dimensions: [{ name: "country" }, { name: "city" }],
        metrics: [{ name: "activeUsers" }, { name: "sessions" }],
        limit: 25
      }),
      runGa4Report(propertyId, accessToken, {
        dateRanges,
        dimensions: [{ name: "eventName" }],
        metrics: [{ name: "eventCount" }],
        limit: 30
      }),
      fetch(
        `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(
          propertyId
        )}:runRealtimeReport`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ metrics: [{ name: "activeUsers" }] })
        }
      ).then((r) => (r.ok ? (r.json() as Promise<Ga4ApiResponse>) : null))
    ]);

    const ovRow = overviewRes.rows?.[0]?.metricValues || [];
    const overview = {
      activeUsers: Number(ovRow[0]?.value || 0),
      totalUsers: Number(ovRow[1]?.value || 0),
      newUsers: Number(ovRow[2]?.value || 0),
      sessions: Number(ovRow[3]?.value || 0),
      screenPageViews: Number(ovRow[4]?.value || 0),
      engagedSessions: Number(ovRow[5]?.value || 0),
      engagementRate: Number(ovRow[6]?.value || 0),
      averageSessionDuration: Number(ovRow[7]?.value || 0)
    };

    const rtUsers = Number(realtimeRes?.rows?.[0]?.metricValues?.[0]?.value ?? 0);

    const dailySeries = (dailyRes.rows || []).map((r) => {
      const rawDate = r.dimensionValues?.[0]?.value || "";
      const formatted =
        rawDate.length === 8
          ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
          : rawDate;
      return {
        date: formatted,
        activeUsers: Number(r.metricValues?.[0]?.value || 0),
        sessions: Number(r.metricValues?.[1]?.value || 0),
        pageViews: Number(r.metricValues?.[2]?.value || 0)
      };
    });

    const topPages = (pagesRes.rows || []).map((r) => ({
      pagePath: r.dimensionValues?.[0]?.value || "/",
      pageTitle: r.dimensionValues?.[1]?.value || "",
      views: Number(r.metricValues?.[0]?.value || 0),
      users: Number(r.metricValues?.[1]?.value || 0),
      avgDuration: Number(r.metricValues?.[2]?.value || 0),
      engagementRate: Number(r.metricValues?.[3]?.value || 0)
    }));

    const sources = (sourcesRes.rows || []).map((r) => ({
      source: r.dimensionValues?.[0]?.value || "(direct)",
      medium: r.dimensionValues?.[1]?.value || "(none)",
      sessions: Number(r.metricValues?.[0]?.value || 0),
      users: Number(r.metricValues?.[1]?.value || 0)
    }));

    const devices = (devicesRes.rows || []).map((r) => ({
      deviceCategory: r.dimensionValues?.[0]?.value || "unknown",
      users: Number(r.metricValues?.[0]?.value || 0),
      sessions: Number(r.metricValues?.[1]?.value || 0)
    }));

    const countries = (countriesRes.rows || []).map((r) => ({
      country: r.dimensionValues?.[0]?.value || "Unknown",
      city: r.dimensionValues?.[1]?.value || "Unknown",
      users: Number(r.metricValues?.[0]?.value || 0),
      sessions: Number(r.metricValues?.[1]?.value || 0)
    }));

    const events = (eventsRes.rows || []).map((r) => ({
      eventName: r.dimensionValues?.[0]?.value || "",
      eventCount: Number(r.metricValues?.[0]?.value || 0)
    }));

    const result: Ga4ReportData = {
      status: "LIVE",
      propertyId,
      measurementId,
      missingEnvVars: [],
      fetchedAt: new Date().toISOString(),
      dateRange,
      realtimeActiveUsers: rtUsers,
      overview,
      dailySeries,
      topPages,
      sources,
      devices,
      countries,
      events
    };

    reportCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, data: result });
    return result;
  } catch (error) {
    return {
      status: "ERROR",
      propertyId,
      measurementId,
      missingEnvVars: [],
      errorMessage: error instanceof Error ? error.message : "Failed to query GA4 Data API",
      fetchedAt: new Date().toISOString(),
      dateRange,
      realtimeActiveUsers: null,
      overview: null,
      dailySeries: [],
      topPages: [],
      sources: [],
      devices: [],
      countries: [],
      events: []
    };
  }
}

interface GscApiRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}

interface GscApiResponse {
  rows?: GscApiRow[];
}

async function queryGscApi(
  siteUrl: string,
  accessToken: string,
  body: Record<string, unknown>
): Promise<GscApiResponse> {
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
    siteUrl
  )}/searchAnalytics/query`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GSC searchAnalytics/query error (${res.status}): ${errText}`);
  }
  return (await res.json()) as GscApiResponse;
}

export async function fetchSearchConsoleAnalytics(
  dateRange: AnalyticsDateRange = "28d"
): Promise<GscReportData> {
  const siteUrl = (process.env.GSC_SITE_URL || "sc-domain:keremmihci.com").trim();
  const sa = resolveServiceAccountCredentials();
  const hasOAuthRefresh = Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
      process.env.GOOGLE_OAUTH_REFRESH_TOKEN
  );

  const missingEnvVars: string[] = [];
  if (!sa && !hasOAuthRefresh) {
    missingEnvVars.push("GOOGLE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
  }

  if (missingEnvVars.length > 0) {
    return {
      status: "NOT_CONFIGURED",
      siteUrl,
      missingEnvVars,
      fetchedAt: new Date().toISOString(),
      dateRange,
      totals: null,
      dailySeries: [],
      queries: [],
      pages: [],
      devices: [],
      countries: []
    };
  }

  const cacheKey = `gsc:${siteUrl}:${dateRange}`;
  const cached = reportCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data as GscReportData;
  }

  try {
    const accessToken = await getGoogleAccessToken([
      "https://www.googleapis.com/auth/webmasters.readonly"
    ]);
    const days = getDaysCount(dateRange);
    const end = new Date();
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const startDate = formatIsoDate(start);
    const endDate = formatIsoDate(end);

    const [dailyRes, queriesRes, pagesRes, devicesRes, countriesRes] = await Promise.all([
      queryGscApi(siteUrl, accessToken, {
        startDate,
        endDate,
        dimensions: ["date"],
        rowLimit: 100
      }),
      queryGscApi(siteUrl, accessToken, {
        startDate,
        endDate,
        dimensions: ["query"],
        rowLimit: 50
      }),
      queryGscApi(siteUrl, accessToken, {
        startDate,
        endDate,
        dimensions: ["page"],
        rowLimit: 100
      }),
      queryGscApi(siteUrl, accessToken, {
        startDate,
        endDate,
        dimensions: ["device"],
        rowLimit: 10
      }),
      queryGscApi(siteUrl, accessToken, {
        startDate,
        endDate,
        dimensions: ["country"],
        rowLimit: 25
      })
    ]);

    const dailySeries = (dailyRes.rows || []).map((r) => ({
      date: r.keys?.[0] || "",
      clicks: Number(r.clicks || 0),
      impressions: Number(r.impressions || 0),
      ctr: Number(r.ctr || 0),
      position: Number(r.position || 0)
    }));

    let totalClicks = 0;
    let totalImpressions = 0;
    let weightedPositionSum = 0;
    for (const d of dailySeries) {
      totalClicks += d.clicks;
      totalImpressions += d.impressions;
      weightedPositionSum += d.position * d.impressions;
    }

    const totals = {
      clicks: totalClicks,
      impressions: totalImpressions,
      ctr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
      position: totalImpressions > 0 ? weightedPositionSum / totalImpressions : 0
    };

    const result: GscReportData = {
      status: "LIVE",
      siteUrl,
      missingEnvVars: [],
      fetchedAt: new Date().toISOString(),
      dateRange,
      totals,
      dailySeries,
      queries: (queriesRes.rows || []).map((r) => ({
        query: r.keys?.[0] || "",
        clicks: Number(r.clicks || 0),
        impressions: Number(r.impressions || 0),
        ctr: Number(r.ctr || 0),
        position: Number(r.position || 0)
      })),
      pages: (pagesRes.rows || []).map((r) => ({
        page: r.keys?.[0] || "",
        clicks: Number(r.clicks || 0),
        impressions: Number(r.impressions || 0),
        ctr: Number(r.ctr || 0),
        position: Number(r.position || 0)
      })),
      devices: (devicesRes.rows || []).map((r) => ({
        device: r.keys?.[0] || "",
        clicks: Number(r.clicks || 0),
        impressions: Number(r.impressions || 0),
        ctr: Number(r.ctr || 0),
        position: Number(r.position || 0)
      })),
      countries: (countriesRes.rows || []).map((r) => ({
        country: r.keys?.[0] || "",
        clicks: Number(r.clicks || 0),
        impressions: Number(r.impressions || 0),
        ctr: Number(r.ctr || 0),
        position: Number(r.position || 0)
      }))
    };

    reportCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, data: result });
    return result;
  } catch (error) {
    return {
      status: "ERROR",
      siteUrl,
      missingEnvVars: [],
      errorMessage: error instanceof Error ? error.message : "Failed to query Search Console API",
      fetchedAt: new Date().toISOString(),
      dateRange,
      totals: null,
      dailySeries: [],
      queries: [],
      pages: [],
      devices: [],
      countries: []
    };
  }
}

/**
 * Maps real GA4 pagePath and Search Console page URLs to portfolio projects (/tr/project/<slug> and /en/project/<slug>).
 * Never fabricates numbers — returns null metrics when GA4 or GSC is not LIVE.
 */
export function buildProjectLevelAnalytics(
  projects: CmsProjectRecord[],
  ga4: Ga4ReportData,
  gsc: GscReportData
): ProjectTrafficInsight[] {
  const ga4Live = ga4.status === "LIVE";
  const gscLive = gsc.status === "LIVE";

  return projects.map((project) => {
    const trPath = `/tr/project/${project.slug}`;
    const enPath = `/en/project/${project.slug}`;

    let trViews: number | null = null;
    let enViews: number | null = null;
    let totalViews: number | null = null;
    let users: number | null = null;
    let avgDuration: number | null = null;

    if (ga4Live) {
      const trMatch = ga4.topPages.find((p) => p.pagePath === trPath || p.pagePath.startsWith(`${trPath}?`));
      const enMatch = ga4.topPages.find((p) => p.pagePath === enPath || p.pagePath.startsWith(`${enPath}?`));
      trViews = trMatch?.views ?? 0;
      enViews = enMatch?.views ?? 0;
      totalViews = trViews + enViews;
      users = (trMatch?.users ?? 0) + (enMatch?.users ?? 0);
      const totalDur =
        (trMatch?.avgDuration ?? 0) * (trMatch?.views ?? 0) +
        (enMatch?.avgDuration ?? 0) * (enMatch?.views ?? 0);
      avgDuration = totalViews > 0 ? totalDur / totalViews : 0;
    }

    let clicks: number | null = null;
    let impressions: number | null = null;
    let ctr: number | null = null;
    let position: number | null = null;

    if (gscLive) {
      const matchingGscPages = gsc.pages.filter(
        (p) => p.page.endsWith(trPath) || p.page.endsWith(enPath)
      );
      clicks = matchingGscPages.reduce((sum, p) => sum + p.clicks, 0);
      impressions = matchingGscPages.reduce((sum, p) => sum + p.impressions, 0);
      ctr = impressions > 0 ? clicks / impressions : 0;
      const weightedPos = matchingGscPages.reduce((sum, p) => sum + p.position * p.impressions, 0);
      position = impressions > 0 ? weightedPos / impressions : 0;
    }

    return {
      projectId: project.id,
      slug: project.slug,
      titleTR: project.titleTR,
      titleEN: project.titleEN,
      workspace: project.workspace,
      status: project.cmsStatus,
      featured: project.featured,
      ga4: {
        totalViews,
        trViews,
        enViews,
        users,
        avgDuration
      },
      gsc: {
        clicks,
        impressions,
        ctr,
        position
      }
    };
  });
}
