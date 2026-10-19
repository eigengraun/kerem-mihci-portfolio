import React from "react";
import { getAdminAuthConfigStatus, getServerAdminSession } from "@/lib/admin/auth";
import { AdminDashboardClient } from "./AdminDashboardClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getServerAdminSession();
  const authConfig = getAdminAuthConfigStatus();

  return (
    <AdminDashboardClient
      initialSession={session}
      authConfig={{
        productionReady: authConfig.productionReady,
        hasGoogleOAuth: authConfig.hasGoogleOAuth,
        hasMasterPassword: authConfig.hasMasterPassword,
        devFixtureEnabled: authConfig.devFixtureEnabled
      }}
    />
  );
}
