import type { Metadata } from "next";
import React from "react";
import "./admin-studio.css";

export const metadata: Metadata = {
  title: "Admin CMS & Analytics — Kerem Mıhçı Portfolio OS",
  description: "Private administrative content management and analytics dashboard.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true
    }
  }
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-studio-root h-[100dvh] max-h-[100dvh] w-full overflow-hidden bg-[#0B0C0E] text-[#F5F7FA] font-sans antialiased selection:bg-indigo-500/30 selection:text-white flex flex-col">
      {children}
    </div>
  );
}
