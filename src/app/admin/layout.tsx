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
    <div className="h-[100dvh] max-h-[100dvh] w-full overflow-hidden bg-[#0B0C10] text-neutral-100 font-sans antialiased selection:bg-blue-500/30 selection:text-white flex flex-col">
      {children}
    </div>
  );
}
