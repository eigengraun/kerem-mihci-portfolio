"use client";

import React, { useState } from "react";
import { useDesktopStore } from "@/store/desktopStore";
import { NotesTabNav, NotesTabId } from "./notes/NotesTabNav";
import { NotesOverviewTab } from "./notes/NotesOverviewTab";
import { NotesAboutTab } from "./notes/NotesAboutTab";
import { NotesExperienceTab } from "./notes/NotesExperienceTab";
import { NotesEducationTab } from "./notes/NotesEducationTab";
import { NotesSkillsTab } from "./notes/NotesSkillsTab";
import { NotesCvTab } from "./notes/NotesCvTab";

let sessionActiveTab: NotesTabId = "notes";

export const NotesApp: React.FC = () => {
  const { locale, theme } = useDesktopStore();
  const [activeTab, setActiveTabState] = useState<NotesTabId>(sessionActiveTab);

  const handleSelectTab = (tab: NotesTabId) => {
    sessionActiveTab = tab;
    setActiveTabState(tab);
  };

  const isLight = theme === "light";

  return (
    <div
      className={`flex flex-col h-full rounded-md shadow-inner transition-colors duration-200 overflow-hidden ${
        isLight
          ? "bg-[#FFFDF5] text-neutral-800 border border-amber-200"
          : "bg-[#2A2725] text-[#ECE7DF] border border-amber-500/20"
      }`}
    >
      {/* Sticky Top Tab Navigation Bar */}
      <NotesTabNav
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        locale={locale}
        isLight={isLight}
      />

      {/* Main Tab Content Area */}
      <div className="flex-1 overflow-y-auto app-scrollbar p-4 md:p-5 select-text">
        {activeTab === "notes" && <NotesOverviewTab locale={locale} isLight={isLight} />}
        {activeTab === "about" && <NotesAboutTab locale={locale} isLight={isLight} />}
        {activeTab === "experience" && <NotesExperienceTab locale={locale} isLight={isLight} />}
        {activeTab === "education" && <NotesEducationTab locale={locale} isLight={isLight} />}
        {activeTab === "skills" && <NotesSkillsTab locale={locale} isLight={isLight} />}
        {activeTab === "cv" && <NotesCvTab locale={locale} isLight={isLight} />}
      </div>
    </div>
  );
};
