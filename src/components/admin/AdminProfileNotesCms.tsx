"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { AdminSessionPayload } from "@/lib/admin/auth";
import type {
  CmsProfileRecord,
  CmsWorkspaceNote,
  CmsExperienceItem,
  CmsEducationItem,
  CmsSkillItem,
  CmsCvDocument,
  CmsSkillCategory,
  WorkspaceCategory
} from "@/lib/portfolio/types";

interface AdminProfileNotesCmsProps {
  session: AdminSessionPayload;
}

type SubSection = "profile" | "notes" | "experience" | "education" | "skills" | "cv";

export const AdminProfileNotesCms: React.FC<AdminProfileNotesCmsProps> = ({ session }) => {
  const [subSection, setSubSection] = useState<SubSection>("profile");
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Data states
  const [profile, setProfile] = useState<CmsProfileRecord | null>(null);
  const [selectedWorkspace, setSelectedWorkspace] = useState<WorkspaceCategory>("design");
  const [notes, setNotes] = useState<CmsWorkspaceNote[]>([]);
  const [experience, setExperience] = useState<CmsExperienceItem[]>([]);
  const [education, setEducation] = useState<CmsEducationItem[]>([]);
  const [skills, setSkills] = useState<CmsSkillItem[]>([]);
  const [selectedSkillCat, setSelectedSkillCat] = useState<CmsSkillCategory | "all">("all");
  const [cvDocuments, setCvDocuments] = useState<CmsCvDocument[]>([]);

  // Note editor modal / inline state
  const [editingNote, setEditingNote] = useState<Partial<CmsWorkspaceNote> | null>(null);

  // Experience editor modal / inline state
  const [editingExp, setEditingExp] = useState<Partial<CmsExperienceItem> | null>(null);

  // Education editor modal / inline state
  const [editingEdu, setEditingEdu] = useState<Partial<CmsEducationItem> | null>(null);

  // Skill editor modal / inline state
  const [editingSkill, setEditingSkill] = useState<Partial<CmsSkillItem> | null>(null);

  // CV Upload state
  const [uploadingCv, setUploadingCv] = useState<boolean>(false);

  const showNotification = (type: "ok" | "err", msg: string) => {
    if (type === "ok") {
      setSuccessMsg(msg);
      setErrorMsg(null);
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      setErrorMsg(msg);
      setSuccessMsg(null);
      setTimeout(() => setErrorMsg(null), 6000);
    }
  };

  // Fetch Core Data
  const loadData = useCallback(async () => {
    try {
      const [profRes, notesRes, expRes, eduRes, skillsRes, cvRes] = await Promise.all([
        fetch("/api/admin/profile"),
        fetch(`/api/admin/notes?workspaceId=${selectedWorkspace}`),
        fetch("/api/admin/experience"),
        fetch("/api/admin/education"),
        fetch("/api/admin/skills"),
        fetch("/api/admin/cv")
      ]);

      if (profRes.ok) {
        const d = await profRes.json();
        setProfile(d.profile);
      }
      if (notesRes.ok) {
        const d = await notesRes.json();
        setNotes(d.notes || []);
      }
      if (expRes.ok) {
        const d = await expRes.json();
        setExperience(d.experience || []);
      }
      if (eduRes.ok) {
        const d = await eduRes.json();
        setEducation(d.education || []);
      }
      if (skillsRes.ok) {
        const d = await skillsRes.json();
        setSkills(d.skills || []);
      }
      if (cvRes.ok) {
        const d = await cvRes.json();
        setCvDocuments(d.documents || []);
      }
    } catch {
      showNotification("err", "Failed to connect to CMS API");
    } finally {
      setLoading(false);
    }
  }, [selectedWorkspace]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  // Reload notes on workspace change
  useEffect(() => {
    fetch(`/api/admin/notes?workspaceId=${selectedWorkspace}`)
      .then((r) => r.json())
      .then((d) => setNotes(d.notes || []))
      .catch(() => {});
  }, [selectedWorkspace]);

  const getAuthHeaders = (contentType: string | null = "application/json") => {
    const headers: Record<string, string> = {};
    if (contentType) headers["Content-Type"] = contentType;
    if (session?.csrfToken) headers["x-csrf-token"] = session.csrfToken;
    return headers;
  };

  // --- Profile Save Handler ---
  const handleSaveProfile = async (targetStatus?: "draft" | "published") => {
    if (!profile) return;
    const finalStatus = targetStatus || profile.status || "draft";

    if (finalStatus === "published") {
      if (!profile.name?.trim() || !profile.email?.trim()) {
        showNotification("err", "Name and email are required to publish profile.");
        return;
      }
      if (!profile.headline?.tr?.trim() || !profile.headline?.en?.trim()) {
        showNotification("err", "Bilingual headlines (TR & EN) required to publish profile.");
        return;
      }
      if (!profile.location?.tr?.trim() || !profile.location?.en?.trim()) {
        showNotification("err", "Bilingual locations (TR & EN) required to publish profile.");
        return;
      }
      if (!profile.summary?.tr?.length || !profile.summary?.en?.length) {
        showNotification("err", "Bilingual summary paragraphs (TR & EN) required to publish profile.");
        return;
      }
    }

    try {
      const res = await fetch("/api/admin/profile", {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: profile.name,
          email: profile.email,
          image: profile.image,
          avatar: profile.avatar,
          status: finalStatus,
          headlineTR: profile.headline.tr,
          headlineEN: profile.headline.en,
          locationTR: profile.location.tr,
          locationEN: profile.location.en,
          altTR: profile.alt.tr,
          altEN: profile.alt.en,
          summaryTR: profile.summary.tr,
          summaryEN: profile.summary.en,
          focusAreasTR: profile.focusAreas.tr,
          focusAreasEN: profile.focusAreas.en,
          stats: profile.stats
        })
      });
      const data = await res.json();
      if (res.ok) {
        setProfile(data.profile);
        showNotification("ok", finalStatus === "published" ? "Profile published successfully." : "Profile draft saved.");
      } else {
        showNotification("err", data.error || "Failed to update profile.");
      }
    } catch {
      showNotification("err", "Network error saving profile.");
    }
  };

  // --- Note Save Handler ---
  const handleSaveNote = async (targetStatus?: "draft" | "published") => {
    if (!editingNote) return;
    const finalStatus = targetStatus || editingNote.status || "draft";

    if (finalStatus === "published") {
      const titleTR = editingNote.title?.tr?.trim() || "";
      const titleEN = editingNote.title?.en?.trim() || "";
      const contentTR = editingNote.content?.tr?.trim() || "";
      const contentEN = editingNote.content?.en?.trim() || "";
      if (!titleTR || !titleEN) {
        showNotification("err", "Bilingual titles (TR & EN) required to publish note.");
        return;
      }
      if (!contentTR || !contentEN) {
        showNotification("err", "Bilingual contents (TR & EN) required to publish note.");
        return;
      }
    }

    try {
      const isCreate = !editingNote.id;
      const url = isCreate ? "/api/admin/notes" : `/api/admin/notes/${editingNote.id}`;
      const method = isCreate ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify({
          workspaceId: selectedWorkspace,
          status: finalStatus,
          sortOrder: editingNote.sortOrder ?? notes.length,
          filename: editingNote.filename || "note.txt",
          titleTR: editingNote.title?.tr || "",
          titleEN: editingNote.title?.en || "",
          contentTR: editingNote.content?.tr || "",
          contentEN: editingNote.content?.en || ""
        })
      });
      const data = await res.json();
      if (res.ok) {
        setEditingNote(null);
        showNotification("ok", finalStatus === "published" ? "Workspace note published." : "Workspace note draft saved.");
        const r = await fetch(`/api/admin/notes?workspaceId=${selectedWorkspace}`);
        const d = await r.json();
        setNotes(d.notes || []);
      } else {
        showNotification("err", data.error || "Failed to save note.");
      }
    } catch {
      showNotification("err", "Network error saving note.");
    }
  };

  const handleToggleNoteStatus = async (note: CmsWorkspaceNote) => {
    const nextStatus = note.status === "published" ? "draft" : "published";
    if (nextStatus === "published") {
      if (!note.title.tr?.trim() || !note.title.en?.trim() || !note.content.tr?.trim() || !note.content.en?.trim()) {
        showNotification("err", "Cannot publish note: Bilingual title and content required.");
        return;
      }
    }
    try {
      const res = await fetch(`/api/admin/notes/${note.id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          workspaceId: note.workspaceId,
          status: nextStatus,
          sortOrder: note.sortOrder,
          filename: note.filename,
          titleTR: note.title.tr,
          titleEN: note.title.en,
          contentTR: note.content.tr,
          contentEN: note.content.en
        })
      });
      if (res.ok) {
        showNotification("ok", `Note marked as ${nextStatus}.`);
        const r = await fetch(`/api/admin/notes?workspaceId=${selectedWorkspace}`);
        const d = await r.json();
        setNotes(d.notes || []);
      } else {
        const d = await res.json();
        showNotification("err", d.error || "Failed to update note status.");
      }
    } catch {
      showNotification("err", "Network error updating note status.");
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (!confirm("Are you sure you want to delete this note?")) return;
    try {
      const res = await fetch(`/api/admin/notes/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(null)
      });
      if (res.ok) {
        showNotification("ok", "Note deleted.");
        setNotes((prev) => prev.filter((n) => n.id !== id));
      } else {
        const d = await res.json();
        showNotification("err", d.error || "Failed to delete note.");
      }
    } catch {
      showNotification("err", "Network error deleting note.");
    }
  };

  // --- Experience Handlers ---
  const handleSaveExp = async (targetStatus?: "draft" | "published") => {
    if (!editingExp) return;
    const finalStatus = targetStatus || editingExp.status || "draft";

    if (finalStatus === "published") {
      const org = editingExp.organization?.trim() || "";
      const start = editingExp.startDate?.trim() || "";
      const roleTR = editingExp.role?.tr?.trim() || "";
      const roleEN = editingExp.role?.en?.trim() || "";
      const descTR = editingExp.description?.tr?.trim() || "";
      const descEN = editingExp.description?.en?.trim() || "";
      if (!org || !start) {
        showNotification("err", "Organization and Start Date required to publish experience.");
        return;
      }
      if (!roleTR || !roleEN) {
        showNotification("err", "Bilingual roles (TR & EN) required to publish experience.");
        return;
      }
      if (!descTR || !descEN) {
        showNotification("err", "Bilingual descriptions (TR & EN) required to publish experience.");
        return;
      }
    }

    try {
      const isCreate = !editingExp.id;
      const url = isCreate ? "/api/admin/experience" : `/api/admin/experience/${editingExp.id}`;
      const method = isCreate ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify({
          organization: editingExp.organization || "",
          startDate: editingExp.startDate || "",
          category: editingExp.category || "work",
          skills: editingExp.skills || [],
          status: finalStatus,
          sortOrder: editingExp.sortOrder ?? experience.length,
          roleTR: editingExp.role?.tr || "",
          roleEN: editingExp.role?.en || "",
          endDateTR: editingExp.endDate?.tr || "",
          endDateEN: editingExp.endDate?.en || "",
          locationTR: editingExp.location?.tr || "",
          locationEN: editingExp.location?.en || "",
          employmentTypeTR: editingExp.employmentType?.tr || "",
          employmentTypeEN: editingExp.employmentType?.en || "",
          descriptionTR: editingExp.description?.tr || "",
          descriptionEN: editingExp.description?.en || ""
        })
      });
      const data = await res.json();
      if (res.ok) {
        setEditingExp(null);
        showNotification("ok", finalStatus === "published" ? "Experience published." : "Experience draft saved.");
        const r = await fetch("/api/admin/experience");
        const d = await r.json();
        setExperience(d.experience || []);
      } else {
        showNotification("err", data.error || "Failed to save experience.");
      }
    } catch {
      showNotification("err", "Network error saving experience.");
    }
  };

  const handleToggleExpStatus = async (exp: CmsExperienceItem) => {
    const nextStatus = exp.status === "published" ? "draft" : "published";
    if (nextStatus === "published") {
      if (!exp.organization || !exp.startDate || !exp.role.tr || !exp.role.en) {
        showNotification("err", "Cannot publish experience: Required fields missing.");
        return;
      }
    }
    try {
      const res = await fetch(`/api/admin/experience/${exp.id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          organization: exp.organization,
          startDate: exp.startDate,
          category: exp.category,
          skills: exp.skills,
          status: nextStatus,
          sortOrder: exp.sortOrder,
          roleTR: exp.role.tr,
          roleEN: exp.role.en,
          endDateTR: exp.endDate.tr,
          endDateEN: exp.endDate.en,
          locationTR: exp.location?.tr || "",
          locationEN: exp.location?.en || "",
          employmentTypeTR: exp.employmentType?.tr || "",
          employmentTypeEN: exp.employmentType?.en || "",
          descriptionTR: exp.description.tr,
          descriptionEN: exp.description.en
        })
      });
      if (res.ok) {
        showNotification("ok", `Experience marked as ${nextStatus}.`);
        const r = await fetch("/api/admin/experience");
        const d = await r.json();
        setExperience(d.experience || []);
      }
    } catch {
      showNotification("err", "Network error toggling experience status.");
    }
  };

  const handleDeleteExp = async (id: string) => {
    if (!confirm("Delete this experience item?")) return;
    try {
      const res = await fetch(`/api/admin/experience/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(null)
      });
      if (res.ok) {
        showNotification("ok", "Experience deleted.");
        setExperience((prev) => prev.filter((e) => e.id !== id));
      }
    } catch {
      showNotification("err", "Network error deleting experience.");
    }
  };

  // --- Education Handlers ---
  const handleSaveEdu = async (targetStatus?: "draft" | "published") => {
    if (!editingEdu) return;
    const finalStatus = targetStatus || editingEdu.status || "draft";

    if (finalStatus === "published") {
      const instTR = editingEdu.institution?.tr?.trim() || "";
      const instEN = editingEdu.institution?.en?.trim() || "";
      const progTR = editingEdu.program?.tr?.trim() || "";
      const progEN = editingEdu.program?.en?.trim() || "";
      if (!instTR || !instEN) {
        showNotification("err", "Bilingual institutions (TR & EN) required to publish education.");
        return;
      }
      if (!progTR || !progEN) {
        showNotification("err", "Bilingual programs (TR & EN) required to publish education.");
        return;
      }
    }

    try {
      const isCreate = !editingEdu.id;
      const url = isCreate ? "/api/admin/education" : `/api/admin/education/${editingEdu.id}`;
      const method = isCreate ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify({
          sortOrder: editingEdu.sortOrder ?? education.length,
          status: finalStatus,
          institutionTR: editingEdu.institution?.tr || "",
          institutionEN: editingEdu.institution?.en || "",
          programTR: editingEdu.program?.tr || "",
          programEN: editingEdu.program?.en || "",
          endYearTR: editingEdu.endYear?.tr || "",
          endYearEN: editingEdu.endYear?.en || "",
          statusLabelTR: editingEdu.statusLabel?.tr || "",
          statusLabelEN: editingEdu.statusLabel?.en || "",
          descriptionTR: editingEdu.description?.tr || "",
          descriptionEN: editingEdu.description?.en || ""
        })
      });
      const data = await res.json();
      if (res.ok) {
        setEditingEdu(null);
        showNotification("ok", finalStatus === "published" ? "Education published." : "Education draft saved.");
        const r = await fetch("/api/admin/education");
        const d = await r.json();
        setEducation(d.education || []);
      } else {
        showNotification("err", data.error || "Failed to save education.");
      }
    } catch {
      showNotification("err", "Network error saving education.");
    }
  };

  const handleToggleEduStatus = async (edu: CmsEducationItem) => {
    const nextStatus = edu.status === "published" ? "draft" : "published";
    if (nextStatus === "published") {
      if (!edu.institution.tr || !edu.institution.en || !edu.program.tr || !edu.program.en) {
        showNotification("err", "Cannot publish education: Required fields missing.");
        return;
      }
    }
    try {
      const res = await fetch(`/api/admin/education/${edu.id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          startYear: edu.startYear || "",
          sortOrder: edu.sortOrder,
          status: nextStatus,
          institutionTR: edu.institution.tr,
          institutionEN: edu.institution.en,
          programTR: edu.program.tr,
          programEN: edu.program.en,
          endYearTR: edu.endYear.tr,
          endYearEN: edu.endYear.en,
          statusLabelTR: edu.statusLabel.tr,
          statusLabelEN: edu.statusLabel.en,
          descriptionTR: edu.description?.tr || "",
          descriptionEN: edu.description?.en || ""
        })
      });
      if (res.ok) {
        showNotification("ok", `Education marked as ${nextStatus}.`);
        const r = await fetch("/api/admin/education");
        const d = await r.json();
        setEducation(d.education || []);
      }
    } catch {
      showNotification("err", "Network error toggling education status.");
    }
  };

  const handleDeleteEdu = async (id: string) => {
    if (!confirm("Delete this education item?")) return;
    try {
      const res = await fetch(`/api/admin/education/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(null)
      });
      if (res.ok) {
        showNotification("ok", "Education deleted.");
        setEducation((prev) => prev.filter((e) => e.id !== id));
      }
    } catch {
      showNotification("err", "Network error deleting education.");
    }
  };

  // --- Skill Handlers ---
  const handleSaveSkill = async (targetStatus?: "draft" | "published") => {
    if (!editingSkill) return;
    const finalStatus = targetStatus || editingSkill.status || "draft";

    if (finalStatus === "published") {
      const nameTR = editingSkill.name?.tr?.trim() || "";
      const nameEN = editingSkill.name?.en?.trim() || "";
      if (!nameTR || !nameEN) {
        showNotification("err", "Bilingual skill names (TR & EN) required to publish skill.");
        return;
      }
    }

    try {
      const isCreate = !editingSkill.id;
      const url = isCreate ? "/api/admin/skills" : `/api/admin/skills/${editingSkill.id}`;
      const method = isCreate ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify({
          category: editingSkill.category || "design",
          status: finalStatus,
          sortOrder: editingSkill.sortOrder ?? skills.length,
          nameTR: editingSkill.name?.tr || "",
          nameEN: editingSkill.name?.en || ""
        })
      });
      const data = await res.json();
      if (res.ok) {
        setEditingSkill(null);
        showNotification("ok", finalStatus === "published" ? "Skill published." : "Skill draft saved.");
        const r = await fetch("/api/admin/skills");
        const d = await r.json();
        setSkills(d.skills || []);
      } else {
        showNotification("err", data.error || "Failed to save skill.");
      }
    } catch {
      showNotification("err", "Network error saving skill.");
    }
  };

  const handleToggleSkillStatus = async (skill: CmsSkillItem) => {
    const nextStatus = skill.status === "published" ? "draft" : "published";
    if (nextStatus === "published") {
      if (!skill.name.tr || !skill.name.en) {
        showNotification("err", "Cannot publish skill: Bilingual name required.");
        return;
      }
    }
    try {
      const res = await fetch(`/api/admin/skills/${skill.id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          category: skill.category,
          status: nextStatus,
          sortOrder: skill.sortOrder,
          nameTR: skill.name.tr,
          nameEN: skill.name.en
        })
      });
      if (res.ok) {
        showNotification("ok", `Skill marked as ${nextStatus}.`);
        const r = await fetch("/api/admin/skills");
        const d = await r.json();
        setSkills(d.skills || []);
      }
    } catch {
      showNotification("err", "Network error toggling skill status.");
    }
  };

  const handleDeleteSkill = async (id: string) => {
    if (!confirm("Delete this skill?")) return;
    try {
      const res = await fetch(`/api/admin/skills/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(null)
      });
      if (res.ok) {
        showNotification("ok", "Skill deleted.");
        setSkills((prev) => prev.filter((s) => s.id !== id));
      }
    } catch {
      showNotification("err", "Network error deleting skill.");
    }
  };

  // --- CV Upload & Toggle Handlers ---
  const handleCvFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, locale: "tr" | "en") => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      showNotification("err", "Only .pdf files are accepted for CV uploads.");
      return;
    }

    setUploadingCv(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("locale", locale);

    try {
      const res = await fetch("/api/admin/cv/upload", {
        method: "POST",
        headers: getAuthHeaders(null),
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        showNotification("ok", `${locale.toUpperCase()} CV uploaded successfully.`);
        const r = await fetch("/api/admin/cv");
        const d = await r.json();
        setCvDocuments(d.documents || []);
      } else {
        showNotification("err", data.error || "Failed to upload CV.");
      }
    } catch {
      showNotification("err", "Network error uploading CV.");
    } finally {
      setUploadingCv(false);
      e.target.value = "";
    }
  };

  const handleToggleCvStatus = async (doc: CmsCvDocument) => {
    const nextStatus = doc.status === "published" ? "draft" : "published";
    try {
      const res = await fetch(`/api/admin/cv/${doc.locale}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json();
      if (res.ok) {
        showNotification("ok", `${doc.locale.toUpperCase()} CV status set to ${nextStatus}.`);
        const r = await fetch("/api/admin/cv");
        const d = await r.json();
        setCvDocuments(d.documents || []);
      } else {
        showNotification("err", data.error || "Failed to update CV status.");
      }
    } catch {
      showNotification("err", "Network error updating CV status.");
    }
  };

  const filteredSkills = selectedSkillCat === "all"
    ? skills
    : skills.filter((s) => s.category === selectedSkillCat);

  return (
    <div className="space-y-6" data-testid="admin-profile-cms-section">
      {/* Notifications */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono">
          ✓ {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-mono">
          ⚠ {errorMsg}
        </div>
      )}

      {/* Header & Sub-Nav */}
      <div className="p-4 rounded-xl bg-[#121418] border border-[#252A33] flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-[#F5F7FA] tracking-tight flex items-center gap-2">
            <span>👤</span>
            <span title={session.email}>Profile & Notes CMS</span>
          </h2>
          <p className="text-xs text-[#A0A8B5] mt-0.5">
            Manage your personal identity, bilingual bio, workspace notes, experience, education, skills, and CVs.
          </p>
        </div>

        {/* Sub-section Pills */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-lg bg-[#181B22] border border-[#252A33]">
          {(
            [
              { id: "profile", label: "Bio & Identity" },
              { id: "notes", label: "Workspace Notes" },
              { id: "experience", label: "Experience" },
              { id: "education", label: "Education" },
              { id: "skills", label: "Skills & Tools" },
              { id: "cv", label: "CV Documents" }
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              data-testid={`cms-tab-${tab.id}`}
              onClick={() => setSubSection(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                subSection === tab.id
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  : "text-[#A0A8B5] hover:text-[#F5F7FA] hover:bg-[#252A33]/50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs font-mono text-[#A0A8B5]">Loading CMS data...</div>
      ) : (
        <>
          {/* ============================================================ */}
          {/* 1. PROFILE SECTION */}
          {/* ============================================================ */}
          {subSection === "profile" && profile && (
            <form onSubmit={(e) => { e.preventDefault(); handleSaveProfile(); }} className="space-y-5">
              <div className="p-5 rounded-xl bg-[#121418] border border-[#252A33] space-y-4">
                <div className="flex items-center justify-between border-b border-[#252A33] pb-3">
                  <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-amber-400">
                    Identity & Contact
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#A0A8B5]">Status:</span>
                    <select
                      data-testid="profile-status-select"
                      value={profile.status}
                      onChange={(e) => setProfile({ ...profile, status: e.target.value as "draft" | "published" })}
                      className="px-2.5 py-1 rounded bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA]"
                    >
                      <option value="published">Published</option>
                      <option value="draft">Draft</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono text-[#A0A8B5] mb-1">Full Name</label>
                    <input
                      data-testid="profile-name-input"
                      type="text"
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-[#A0A8B5] mb-1">Email</label>
                    <input
                      type="email"
                      value={profile.email}
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-[#A0A8B5] mb-1">Profile Image Path</label>
                    <input
                      type="text"
                      value={profile.image}
                      onChange={(e) => setProfile({ ...profile, image: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-[#A0A8B5] mb-1">Avatar Image Path</label>
                    <input
                      type="text"
                      value={profile.avatar}
                      onChange={(e) => setProfile({ ...profile, avatar: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA]"
                    />
                  </div>
                </div>

                {/* Bilingual Headlines & Locations */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-mono text-[#A0A8B5] mb-1">Headline (TR)</label>
                    <input
                      data-testid="profile-headline-tr-input"
                      type="text"
                      value={profile.headline.tr}
                      onChange={(e) => setProfile({ ...profile, headline: { ...profile.headline, tr: e.target.value } })}
                      className="w-full px-3 py-2 rounded-lg bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-[#A0A8B5] mb-1">Headline (EN)</label>
                    <input
                      data-testid="profile-headline-en-input"
                      type="text"
                      value={profile.headline.en}
                      onChange={(e) => setProfile({ ...profile, headline: { ...profile.headline, en: e.target.value } })}
                      className="w-full px-3 py-2 rounded-lg bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-[#A0A8B5] mb-1">Location (TR)</label>
                    <input
                      type="text"
                      value={profile.location.tr}
                      onChange={(e) => setProfile({ ...profile, location: { ...profile.location, tr: e.target.value } })}
                      className="w-full px-3 py-2 rounded-lg bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-[#A0A8B5] mb-1">Location (EN)</label>
                    <input
                      type="text"
                      value={profile.location.en}
                      onChange={(e) => setProfile({ ...profile, location: { ...profile.location, en: e.target.value } })}
                      className="w-full px-3 py-2 rounded-lg bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA]"
                    />
                  </div>
                </div>

                {/* Summaries */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-mono text-[#A0A8B5] mb-1">Summary Paragraphs (TR - 1 per line)</label>
                    <textarea
                      rows={5}
                      value={profile.summary.tr.join("\n\n")}
                      onChange={(e) => setProfile({ ...profile, summary: { ...profile.summary, tr: e.target.value.split("\n\n").filter(Boolean) } })}
                      className="w-full px-3 py-2 rounded-lg bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA] font-sans"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-[#A0A8B5] mb-1">Summary Paragraphs (EN - 1 per line)</label>
                    <textarea
                      rows={5}
                      value={profile.summary.en.join("\n\n")}
                      onChange={(e) => setProfile({ ...profile, summary: { ...profile.summary, en: e.target.value.split("\n\n").filter(Boolean) } })}
                      className="w-full px-3 py-2 rounded-lg bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA] font-sans"
                    />
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    data-testid="profile-save-draft-btn"
                    onClick={() => handleSaveProfile("draft")}
                    className="px-4 py-2 rounded-lg bg-[#181B22] border border-[#252A33] hover:bg-[#1E222A] text-amber-300 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Save Draft
                  </button>
                  <button
                    type="button"
                    data-testid="profile-publish-btn"
                    onClick={() => handleSaveProfile("published")}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    Publish Profile
                  </button>
                  {profile.status === "published" && (
                    <button
                      type="button"
                      data-testid="profile-unpublish-btn"
                      onClick={() => handleSaveProfile("draft")}
                      className="px-3.5 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-mono transition-colors cursor-pointer"
                    >
                      Unpublish (Move to Draft)
                    </button>
                  )}
                </div>
              </div>
            </form>
          )}

          {/* ============================================================ */}
          {/* 2. WORKSPACE NOTES SECTION */}
          {/* ============================================================ */}
          {subSection === "notes" && (
            <div className="space-y-4">
              {/* Workspace Selector Bar */}
              <div className="p-4 rounded-xl bg-[#121418] border border-[#252A33] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-[#A0A8B5]">Active Workspace:</span>
                  {(["design", "web", "motion-ai"] as const).map((ws) => (
                    <button
                      key={ws}
                      type="button"
                      data-testid={`notes-workspace-tab-${ws}`}
                      onClick={() => setSelectedWorkspace(ws)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition-colors cursor-pointer ${
                        selectedWorkspace === ws
                          ? "bg-amber-500 text-black shadow-xs"
                          : "bg-[#181B22] text-[#A0A8B5] hover:text-[#F5F7FA] border border-[#252A33]"
                      }`}
                    >
                      {ws} ({notes.length})
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  data-testid="notes-add-btn"
                  onClick={() => setEditingNote({ workspaceId: selectedWorkspace, status: "draft", sortOrder: notes.length, filename: `note-0${notes.length + 1}.txt`, title: { tr: "", en: "" }, content: { tr: "", en: "" } })}
                  className="px-3.5 py-1.5 rounded-lg bg-[#181B22] hover:bg-[#1E222A] border border-amber-500/30 text-xs font-bold text-amber-300 transition-colors cursor-pointer"
                >
                  + Add Note to {selectedWorkspace.toUpperCase()}
                </button>
              </div>

              {/* Note Editor Modal */}
              {editingNote && (
                <div className="p-5 rounded-xl bg-[#121418] border border-amber-500/40 space-y-4 shadow-lg">
                  <div className="flex items-center justify-between border-b border-[#252A33] pb-2">
                    <h3 className="text-xs font-mono uppercase font-bold text-amber-400">
                      {editingNote.id ? "Edit Workspace Note" : `Create Note for ${selectedWorkspace.toUpperCase()}`}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setEditingNote(null)}
                      className="text-xs font-mono text-[#A0A8B5] hover:text-white"
                    >
                      ✕ Close
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-mono text-[#A0A8B5] mb-1">Filename</label>
                      <input
                        type="text"
                        value={editingNote.filename || ""}
                        onChange={(e) => setEditingNote({ ...editingNote, filename: e.target.value })}
                        className="w-full px-3 py-1.5 rounded bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-[#A0A8B5] mb-1">Status</label>
                      <select
                        value={editingNote.status || "published"}
                        onChange={(e) => setEditingNote({ ...editingNote, status: e.target.value as "published" | "draft" | "archived" })}
                        className="w-full px-3 py-1.5 rounded bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA]"
                      >
                        <option value="published">Published</option>
                        <option value="draft">Draft</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-[#A0A8B5] mb-1">Sort Order</label>
                      <input
                        type="number"
                        value={editingNote.sortOrder ?? 0}
                        onChange={(e) => setEditingNote({ ...editingNote, sortOrder: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 rounded bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-mono text-[#A0A8B5] mb-1">Title (TR)</label>
                      <input
                        data-testid="note-title-tr-input"
                        type="text"
                        value={editingNote.title?.tr || ""}
                        onChange={(e) => setEditingNote({ ...editingNote, title: { tr: e.target.value, en: editingNote.title?.en || "" } })}
                        className="w-full px-3 py-1.5 rounded bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-[#A0A8B5] mb-1">Title (EN)</label>
                      <input
                        data-testid="note-title-en-input"
                        type="text"
                        value={editingNote.title?.en || ""}
                        onChange={(e) => setEditingNote({ ...editingNote, title: { tr: editingNote.title?.tr || "", en: e.target.value } })}
                        className="w-full px-3 py-1.5 rounded bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-mono text-[#A0A8B5] mb-1">Content (TR)</label>
                      <textarea
                        data-testid="note-content-tr-input"
                        rows={4}
                        value={editingNote.content?.tr || ""}
                        onChange={(e) => setEditingNote({ ...editingNote, content: { tr: e.target.value, en: editingNote.content?.en || "" } })}
                        className="w-full px-3 py-2 rounded bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA] font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-[#A0A8B5] mb-1">Content (EN)</label>
                      <textarea
                        data-testid="note-content-en-input"
                        rows={4}
                        value={editingNote.content?.en || ""}
                        onChange={(e) => setEditingNote({ ...editingNote, content: { tr: editingNote.content?.tr || "", en: e.target.value } })}
                        className="w-full px-3 py-2 rounded bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA] font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <button
                      type="button"
                      data-testid="note-save-draft-btn"
                      onClick={() => handleSaveNote("draft")}
                      className="px-3.5 py-2 rounded-lg bg-[#181B22] border border-[#252A33] hover:bg-[#1E222A] text-amber-300 font-bold text-xs"
                    >
                      Save Draft
                    </button>
                    <button
                      type="button"
                      data-testid="note-publish-btn"
                      onClick={() => handleSaveNote("published")}
                      className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                    >
                      Publish Note
                    </button>
                    {editingNote.id && editingNote.status === "published" && (
                      <button
                        type="button"
                        onClick={() => handleSaveNote("draft")}
                        className="px-3 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-mono"
                      >
                        Unpublish
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditingNote(null)}
                      className="px-3.5 py-2 rounded-lg bg-[#181B22] text-[#A0A8B5] text-xs hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Note List */}
              <div className="space-y-2.5">
                {notes.length === 0 ? (
                  <div className="p-8 text-center bg-[#121418] rounded-xl border border-[#252A33] text-[#A0A8B5] text-xs font-mono">
                    No notes found for workspace &quot;{selectedWorkspace}&quot;. Click &quot;+ Add Note&quot; to create one.
                  </div>
                ) : (
                  notes.map((note) => (
                    <div
                      key={note.id}
                      className="p-4 rounded-xl bg-[#121418] border border-[#252A33] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#F5F7FA]">
                            {note.title.tr || note.title.en || "Untitled Note"}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#181B22] border border-[#252A33] text-[#A0A8B5]">
                            {note.filename}
                          </span>
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded uppercase ${
                            note.status === "published" ? "text-emerald-400 bg-emerald-500/10" : "text-amber-400 bg-amber-500/10"
                          }`}>
                            {note.status}
                          </span>
                        </div>
                        <p className="text-xs text-[#A0A8B5] font-mono line-clamp-1">
                          {note.content.tr || note.content.en}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleNoteStatus(note)}
                          className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono font-medium transition-colors ${
                            note.status === "published"
                              ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30"
                              : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                          }`}
                        >
                          {note.status === "published" ? "Unpublish" : "Publish"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingNote(note)}
                          className="px-3 py-1.5 rounded-lg bg-[#181B22] hover:bg-[#1E222A] text-xs font-medium text-[#F5F7FA] border border-[#252A33]"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteNote(note.id)}
                          className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-xs font-medium text-red-300 border border-red-500/30"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* 3. EXPERIENCE SECTION */}
          {/* ============================================================ */}
          {subSection === "experience" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#121418] border border-[#252A33] flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-amber-400">
                    Experience Timeline ({experience.length})
                  </h3>
                  <p className="text-xs text-[#A0A8B5] mt-0.5">Chronological professional history and roles.</p>
                </div>
                <button
                  type="button"
                  data-testid="exp-add-btn"
                  onClick={() => setEditingExp({ status: "draft", category: "work", skills: [], role: { tr: "", en: "" }, endDate: { tr: "", en: "" }, description: { tr: "", en: "" } })}
                  className="px-3.5 py-1.5 rounded-lg bg-[#181B22] hover:bg-[#1E222A] border border-amber-500/30 text-xs font-bold text-amber-300"
                >
                  + Add Experience
                </button>
              </div>

              {/* Experience Editor */}
              {editingExp && (
                <div className="p-5 rounded-xl bg-[#121418] border border-amber-500/40 space-y-4">
                  <div className="flex items-center justify-between border-b border-[#252A33] pb-2">
                    <h3 className="text-xs font-mono uppercase font-bold text-amber-400">
                      {editingExp.id ? "Edit Experience" : "Add Experience"}
                    </h3>
                    <button type="button" onClick={() => setEditingExp(null)} className="text-xs text-[#A0A8B5]">✕ Close</button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-mono text-[#A0A8B5] mb-1">Organization</label>
                      <input
                        data-testid="exp-org-input"
                        type="text"
                        value={editingExp.organization || ""}
                        onChange={(e) => setEditingExp({ ...editingExp, organization: e.target.value })}
                        className="w-full px-3 py-1.5 rounded bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-[#A0A8B5] mb-1">Start Date</label>
                      <input
                        data-testid="exp-start-input"
                        type="text"
                        value={editingExp.startDate || ""}
                        onChange={(e) => setEditingExp({ ...editingExp, startDate: e.target.value })}
                        className="w-full px-3 py-1.5 rounded bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-[#A0A8B5] mb-1">Category</label>
                      <select
                        value={editingExp.category || "work"}
                        onChange={(e) => setEditingExp({ ...editingExp, category: e.target.value as "work" | "freelance" | "ai" | "creative" | "volunteer" })}
                        className="w-full px-3 py-1.5 rounded bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA]"
                      >
                        <option value="work">Work</option>
                        <option value="freelance">Freelance</option>
                        <option value="ai">AI</option>
                        <option value="creative">Creative</option>
                        <option value="volunteer">Volunteer</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-mono text-[#A0A8B5] mb-1">Role (TR)</label>
                      <input
                        data-testid="exp-role-tr-input"
                        type="text"
                        value={editingExp.role?.tr || ""}
                        onChange={(e) => setEditingExp({ ...editingExp, role: { tr: e.target.value, en: editingExp.role?.en || "" } })}
                        className="w-full px-3 py-1.5 rounded bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-[#A0A8B5] mb-1">Role (EN)</label>
                      <input
                        data-testid="exp-role-en-input"
                        type="text"
                        value={editingExp.role?.en || ""}
                        onChange={(e) => setEditingExp({ ...editingExp, role: { tr: editingExp.role?.tr || "", en: e.target.value } })}
                        className="w-full px-3 py-1.5 rounded bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-[#A0A8B5] mb-1">End Date (TR)</label>
                      <input
                        type="text"
                        value={editingExp.endDate?.tr || ""}
                        onChange={(e) => setEditingExp({ ...editingExp, endDate: { tr: e.target.value, en: editingExp.endDate?.en || "" } })}
                        className="w-full px-3 py-1.5 rounded bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-[#A0A8B5] mb-1">End Date (EN)</label>
                      <input
                        type="text"
                        value={editingExp.endDate?.en || ""}
                        onChange={(e) => setEditingExp({ ...editingExp, endDate: { tr: editingExp.endDate?.tr || "", en: e.target.value } })}
                        className="w-full px-3 py-1.5 rounded bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-mono text-[#A0A8B5] mb-1">Description (TR)</label>
                      <textarea
                        data-testid="exp-desc-tr-input"
                        rows={3}
                        value={editingExp.description?.tr || ""}
                        onChange={(e) => setEditingExp({ ...editingExp, description: { tr: e.target.value, en: editingExp.description?.en || "" } })}
                        className="w-full px-3 py-1.5 rounded bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-[#A0A8B5] mb-1">Description (EN)</label>
                      <textarea
                        data-testid="exp-desc-en-input"
                        rows={3}
                        value={editingExp.description?.en || ""}
                        onChange={(e) => setEditingExp({ ...editingExp, description: { tr: editingExp.description?.tr || "", en: e.target.value } })}
                        className="w-full px-3 py-1.5 rounded bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA]"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <button type="button" data-testid="exp-save-draft-btn" onClick={() => handleSaveExp("draft")} className="px-3.5 py-2 rounded-lg bg-[#181B22] border border-[#252A33] hover:bg-[#1E222A] text-amber-300 font-bold text-xs">Save Draft</button>
                    <button type="button" data-testid="exp-publish-btn" onClick={() => handleSaveExp("published")} className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs">Publish Experience</button>
                    {editingExp.id && editingExp.status === "published" && (
                      <button type="button" onClick={() => handleSaveExp("draft")} className="px-3 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-mono">Unpublish</button>
                    )}
                    <button type="button" onClick={() => setEditingExp(null)} className="px-3.5 py-2 rounded-lg bg-[#181B22] text-[#A0A8B5] text-xs hover:text-white">Cancel</button>
                  </div>
                </div>
              )}

              {/* Experience Feed */}
              <div className="space-y-2.5">
                {experience.map((item) => (
                  <div key={item.id} className="p-4 rounded-xl bg-[#121418] border border-[#252A33] flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#F5F7FA]">{item.role.tr || item.role.en}</span>
                        <span className="text-xs text-amber-500 font-mono">@{item.organization}</span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded uppercase ${
                          item.status === "published" ? "text-emerald-400 bg-emerald-500/10" : "text-amber-400 bg-amber-500/10"
                        }`}>
                          {item.status}
                        </span>
                      </div>
                      <span className="text-xs text-[#A0A8B5] font-mono">{item.startDate} — {item.endDate.tr || item.endDate.en}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleExpStatus(item)}
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono font-medium transition-colors ${
                          item.status === "published"
                            ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30"
                            : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                        }`}
                      >
                        {item.status === "published" ? "Unpublish" : "Publish"}
                      </button>
                      <button type="button" onClick={() => setEditingExp(item)} className="px-3 py-1.5 rounded-lg bg-[#181B22] text-xs text-[#F5F7FA] border border-[#252A33]">Edit</button>
                      <button type="button" onClick={() => handleDeleteExp(item.id)} className="px-3 py-1.5 rounded-lg bg-red-500/10 text-xs text-red-300 border border-red-500/30">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* 4. EDUCATION SECTION */}
          {/* ============================================================ */}
          {subSection === "education" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#121418] border border-[#252A33] flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-amber-400">
                    Education Items ({education.length})
                  </h3>
                  <p className="text-xs text-[#A0A8B5] mt-0.5">Academic institutions and degree programs.</p>
                </div>
                <button
                  type="button"
                  data-testid="edu-add-btn"
                  onClick={() => setEditingEdu({ status: "draft", institution: { tr: "", en: "" }, program: { tr: "", en: "" }, endYear: { tr: "", en: "" }, statusLabel: { tr: "", en: "" } })}
                  className="px-3.5 py-1.5 rounded-lg bg-[#181B22] hover:bg-[#1E222A] border border-amber-500/30 text-xs font-bold text-amber-300"
                >
                  + Add Education
                </button>
              </div>

              {/* Education Editor */}
              {editingEdu && (
                <div className="p-5 rounded-xl bg-[#121418] border border-amber-500/40 space-y-4">
                  <div className="flex items-center justify-between border-b border-[#252A33] pb-2">
                    <h3 className="text-xs font-mono uppercase font-bold text-amber-400">
                      {editingEdu.id ? "Edit Education" : "Add Education"}
                    </h3>
                    <button type="button" onClick={() => setEditingEdu(null)} className="text-xs text-[#A0A8B5]">✕ Close</button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-mono text-[#A0A8B5] mb-1">Institution (TR)</label>
                      <input
                        data-testid="edu-inst-tr-input"
                        type="text"
                        value={editingEdu.institution?.tr || ""}
                        onChange={(e) => setEditingEdu({ ...editingEdu, institution: { tr: e.target.value, en: editingEdu.institution?.en || "" } })}
                        className="w-full px-3 py-1.5 rounded bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-[#A0A8B5] mb-1">Institution (EN)</label>
                      <input
                        data-testid="edu-inst-en-input"
                        type="text"
                        value={editingEdu.institution?.en || ""}
                        onChange={(e) => setEditingEdu({ ...editingEdu, institution: { tr: editingEdu.institution?.tr || "", en: e.target.value } })}
                        className="w-full px-3 py-1.5 rounded bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-[#A0A8B5] mb-1">Program (TR)</label>
                      <input
                        data-testid="edu-prog-tr-input"
                        type="text"
                        value={editingEdu.program?.tr || ""}
                        onChange={(e) => setEditingEdu({ ...editingEdu, program: { tr: e.target.value, en: editingEdu.program?.en || "" } })}
                        className="w-full px-3 py-1.5 rounded bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-[#A0A8B5] mb-1">Program (EN)</label>
                      <input
                        data-testid="edu-prog-en-input"
                        type="text"
                        value={editingEdu.program?.en || ""}
                        onChange={(e) => setEditingEdu({ ...editingEdu, program: { tr: editingEdu.program?.tr || "", en: e.target.value } })}
                        className="w-full px-3 py-1.5 rounded bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA]"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <button type="button" data-testid="edu-save-draft-btn" onClick={() => handleSaveEdu("draft")} className="px-3.5 py-2 rounded-lg bg-[#181B22] border border-[#252A33] hover:bg-[#1E222A] text-amber-300 font-bold text-xs">Save Draft</button>
                    <button type="button" data-testid="edu-publish-btn" onClick={() => handleSaveEdu("published")} className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs">Publish Education</button>
                    {editingEdu.id && editingEdu.status === "published" && (
                      <button type="button" onClick={() => handleSaveEdu("draft")} className="px-3 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-mono">Unpublish</button>
                    )}
                    <button type="button" onClick={() => setEditingEdu(null)} className="px-3.5 py-2 rounded-lg bg-[#181B22] text-[#A0A8B5] text-xs hover:text-white">Cancel</button>
                  </div>
                </div>
              )}

              {/* Education List */}
              <div className="space-y-2.5">
                {education.map((item) => (
                  <div key={item.id} className="p-4 rounded-xl bg-[#121418] border border-[#252A33] flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-[#F5F7FA]">{item.institution.tr || item.institution.en}</h4>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded uppercase ${
                          item.status === "published" ? "text-emerald-400 bg-emerald-500/10" : "text-amber-400 bg-amber-500/10"
                        }`}>
                          {item.status}
                        </span>
                      </div>
                      <p className="text-xs text-amber-500 font-mono">{item.program.tr || item.program.en}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleEduStatus(item)}
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono font-medium transition-colors ${
                          item.status === "published"
                            ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30"
                            : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                        }`}
                      >
                        {item.status === "published" ? "Unpublish" : "Publish"}
                      </button>
                      <button type="button" onClick={() => setEditingEdu(item)} className="px-3 py-1.5 rounded-lg bg-[#181B22] text-xs text-[#F5F7FA] border border-[#252A33]">Edit</button>
                      <button type="button" onClick={() => handleDeleteEdu(item.id)} className="px-3 py-1.5 rounded-lg bg-red-500/10 text-xs text-red-300 border border-red-500/30">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* 5. SKILLS SECTION */}
          {/* ============================================================ */}
          {subSection === "skills" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#121418] border border-[#252A33] flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-mono text-[#A0A8B5] mr-1">Category:</span>
                  {(["all", "design", "web", "production", "ai", "strategy", "tools"] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      data-testid={`skill-filter-${cat}`}
                      onClick={() => setSelectedSkillCat(cat)}
                      className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors cursor-pointer ${
                        selectedSkillCat === cat
                          ? "bg-amber-500 text-black font-bold"
                          : "bg-[#181B22] text-[#A0A8B5] hover:text-[#F5F7FA] border border-[#252A33]"
                      }`}
                    >
                      {cat.toUpperCase()}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  data-testid="skill-add-btn"
                  onClick={() => setEditingSkill({ category: selectedSkillCat === "all" ? "design" : selectedSkillCat, status: "draft", name: { tr: "", en: "" } })}
                  className="px-3.5 py-1.5 rounded-lg bg-[#181B22] hover:bg-[#1E222A] border border-amber-500/30 text-xs font-bold text-amber-300"
                >
                  + Add Skill
                </button>
              </div>

              {/* Skill Editor */}
              {editingSkill && (
                <div className="p-4 rounded-xl bg-[#121418] border border-amber-500/40 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-mono text-[#A0A8B5] mb-1">Category</label>
                      <select
                        data-testid="skill-cat-select"
                        value={editingSkill.category || "design"}
                        onChange={(e) => setEditingSkill({ ...editingSkill, category: e.target.value as CmsSkillCategory })}
                        className="w-full px-3 py-1.5 rounded bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA]"
                      >
                        <option value="design">Design</option>
                        <option value="web">Web</option>
                        <option value="production">Production</option>
                        <option value="ai">AI</option>
                        <option value="strategy">Strategy</option>
                        <option value="tools">Tools</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-[#A0A8B5] mb-1">Name (TR)</label>
                      <input
                        data-testid="skill-name-tr-input"
                        type="text"
                        value={editingSkill.name?.tr || ""}
                        onChange={(e) => setEditingSkill({ ...editingSkill, name: { tr: e.target.value, en: editingSkill.name?.en || "" } })}
                        className="w-full px-3 py-1.5 rounded bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-[#A0A8B5] mb-1">Name (EN)</label>
                      <input
                        data-testid="skill-name-en-input"
                        type="text"
                        value={editingSkill.name?.en || ""}
                        onChange={(e) => setEditingSkill({ ...editingSkill, name: { tr: editingSkill.name?.tr || "", en: e.target.value } })}
                        className="w-full px-3 py-1.5 rounded bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA]"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button type="button" data-testid="skill-save-draft-btn" onClick={() => handleSaveSkill("draft")} className="px-3.5 py-1.5 rounded bg-[#181B22] border border-[#252A33] hover:bg-[#1E222A] text-amber-300 font-bold text-xs">Save Draft</button>
                    <button type="button" data-testid="skill-publish-btn" onClick={() => handleSaveSkill("published")} className="px-3.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs">Publish Skill</button>
                    {editingSkill.id && editingSkill.status === "published" && (
                      <button type="button" onClick={() => handleSaveSkill("draft")} className="px-3 py-1.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-mono">Unpublish</button>
                    )}
                    <button type="button" onClick={() => setEditingSkill(null)} className="px-3.5 py-1.5 rounded bg-[#181B22] text-[#A0A8B5] text-xs">Cancel</button>
                  </div>
                </div>
              )}

              {/* Skills Chips Grid */}
              <div className="flex flex-wrap gap-2 p-5 rounded-xl bg-[#121418] border border-[#252A33]">
                {filteredSkills.map((sk) => (
                  <div
                    key={sk.id}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#181B22] border border-[#252A33] text-xs text-[#F5F7FA]"
                  >
                    <span>{sk.name.tr}{sk.name.en && sk.name.en !== sk.name.tr ? ` (${sk.name.en})` : ""}</span>
                    <span className="text-[10px] font-mono text-amber-500/70">[{sk.category}]</span>
                    <span className={`text-[9px] font-mono px-1 rounded uppercase ${
                      sk.status === "published" ? "text-emerald-400 bg-emerald-500/10" : "text-amber-400 bg-amber-500/10"
                    }`}>
                      {sk.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleSkillStatus(sk)}
                      className="text-[10px] font-mono text-[#A0A8B5] hover:text-white underline ml-0.5"
                    >
                      {sk.status === "published" ? "draft" : "pub"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSkill(sk.id)}
                      className="text-[#A0A8B5] hover:text-red-400 ml-1 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* 6. CV DOCUMENTS SECTION */}
          {/* ============================================================ */}
          {subSection === "cv" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#121418] border border-[#252A33]">
                <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-amber-400">
                  Curriculum Vitae (PDF Documents)
                </h3>
                <p className="text-xs text-[#A0A8B5] mt-0.5">
                  Upload authentic bilingual PDF files. Magic bytes (%PDF-) and max 15MB file size are enforced.
                  Coming soon placeholder remains active until a genuine PDF is uploaded and published.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(["tr", "en"] as const).map((loc) => {
                  const doc = cvDocuments.find((c) => c.locale === loc);
                  const isPublished = doc?.status === "published";
                  const hasFile = Boolean(doc && doc.byteSize > 0);

                  return (
                    <div
                      key={loc}
                      className="p-5 rounded-xl bg-[#121418] border border-[#252A33] flex flex-col justify-between space-y-4"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-bold text-sm text-[#F5F7FA] font-mono uppercase">
                            {loc === "tr" ? "🇹🇷 Turkish CV" : "🇬🇧 English CV"}
                          </h4>
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold ${
                              isPublished
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            }`}
                          >
                            {doc?.status || "draft (empty)"}
                          </span>
                        </div>

                        {hasFile ? (
                          <div className="space-y-1 text-xs font-mono text-[#A0A8B5] bg-[#181B22] p-3 rounded-lg border border-[#252A33]">
                            <div>File: <span className="text-[#F5F7FA]">{doc?.filename}</span></div>
                            <div>Size: <span className="text-[#F5F7FA]">{Math.round((doc?.byteSize || 0) / 1024)} KB</span></div>
                            <div>Storage: <span className="text-[#F5F7FA]">{doc?.storageMode}</span></div>
                            {doc?.publicUrl && (
                              <div className="pt-1">
                                <a
                                  href={doc.publicUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-amber-400 hover:underline"
                                >
                                  Preview File ↗
                                </a>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs font-mono text-[#A0A8B5] italic bg-[#181B22] p-3 rounded-lg border border-[#252A33]">
                            No genuine PDF uploaded yet. Public visitors see &quot;CV coming soon&quot;.
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#252A33]">
                        <label className="px-3.5 py-1.5 rounded-lg bg-[#181B22] hover:bg-[#1E222A] text-xs font-bold text-amber-300 border border-amber-500/30 cursor-pointer">
                          {uploadingCv ? "Uploading..." : "Upload New PDF"}
                          <input
                            data-testid={`cv-file-input-${loc}`}
                            type="file"
                            accept=".pdf,application/pdf"
                            className="hidden"
                            disabled={uploadingCv}
                            onChange={(e) => handleCvFileUpload(e, loc)}
                          />
                        </label>

                        {hasFile && (
                          <button
                            type="button"
                            data-testid={`cv-toggle-btn-${loc}`}
                            onClick={() => handleToggleCvStatus(doc!)}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                              isPublished
                                ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30"
                                : "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30"
                            }`}
                          >
                            {isPublished ? "Unpublish to Draft" : "Publish to Live"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
