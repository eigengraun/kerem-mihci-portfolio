import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getServerAdminSession } from "@/lib/admin/auth";
import { getAdminProjectByIdOrSlug } from "@/lib/portfolio/repository";
import { ProjectApp } from "@/components/applications/ProjectApp";

export const dynamic = "force-dynamic";

export default async function AdminDraftPreviewPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ locale?: string }>;
}) {
  const session = await getServerAdminSession();
  if (!session) {
    redirect("/admin");
  }

  const { slug } = await params;
  const sp = await searchParams;
  const previewLocale = sp.locale === "en" ? "en" : "tr";

  const project = await getAdminProjectByIdOrSlug(decodeURIComponent(slug));
  if (!project) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#090A0E] text-white flex flex-col">
      {/* Top Preview Banner */}
      <header className="sticky top-0 z-50 bg-amber-500/15 border-b border-amber-500/30 px-6 py-3 flex flex-wrap items-center justify-between gap-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono uppercase font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
            Admin Preview Mode ({project.cmsStatus.toUpperCase()})
          </span>
          <span className="text-sm font-medium text-neutral-200">
            {previewLocale === "en" ? project.titleEN : project.titleTR}
          </span>
          <span className="text-xs font-mono text-neutral-400">/{project.slug}</span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/admin/preview/${project.slug}?locale=tr`}
            className={`px-3 py-1 rounded text-xs font-mono border ${
              previewLocale === "tr"
                ? "bg-white text-black border-white font-semibold"
                : "border-white/20 text-neutral-300 hover:bg-white/10"
            }`}
          >
            TR Önizleme
          </Link>
          <Link
            href={`/admin/preview/${project.slug}?locale=en`}
            className={`px-3 py-1 rounded text-xs font-mono border ${
              previewLocale === "en"
                ? "bg-white text-black border-white font-semibold"
                : "border-white/20 text-neutral-300 hover:bg-white/10"
            }`}
          >
            EN Preview
          </Link>
          <Link
            href="/admin"
            className="px-3 py-1 rounded text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-white/15"
          >
            ← Back to CMS Dashboard
          </Link>
        </div>
      </header>

      {/* Simulated Portfolio OS Window Stage */}
      <main className="flex-1 p-6 md:p-10 flex justify-center items-start overflow-y-auto">
        <div
          className="w-full max-w-4xl rounded-xl border border-white/15 bg-[#161618] shadow-2xl overflow-hidden"
          style={{ minHeight: "640px" }}
        >
          <div className="px-4 py-2.5 bg-neutral-900 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#FF5F56]" />
              <span className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
              <span className="w-3 h-3 rounded-full bg-[#27C93F]" />
            </div>
            <span className="text-xs font-mono text-neutral-400">
              {previewLocale === "en"
                ? `Information about: ${project.titleEN}`
                : `${project.titleTR} — Proje Bilgisi`}
            </span>
            <span className="text-[11px] font-mono text-neutral-500">{project.workspace}</span>
          </div>
          <div className="h-[720px] overflow-y-auto">
            <ProjectApp project={project} />
          </div>
        </div>
      </main>
    </div>
  );
}
