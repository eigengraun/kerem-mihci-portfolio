import type { Metadata } from "next";
import React from "react";

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
    <div className="min-h-screen bg-[#0B0C10] text-neutral-100 font-sans antialiased selection:bg-blue-500/30 selection:text-white">
      {children}
    </div>
  );
}
