"use client";

import React from "react";
import dynamic from "next/dynamic";
import { WindowAppLoading } from "./WindowAppLoading";

export const DynamicProjectApp = dynamic(
  () => import("@/components/applications/ProjectApp").then((mod) => mod.ProjectApp),
  {
    loading: () => <WindowAppLoading />
  }
);

export const DynamicProjectsApp = dynamic(
  () => import("@/components/applications/ProjectsApp").then((mod) => mod.ProjectsApp),
  {
    loading: () => <WindowAppLoading />
  }
);

export const DynamicAboutApp = dynamic(
  () => import("@/components/applications/AboutApp").then((mod) => mod.AboutApp),
  {
    loading: () => <WindowAppLoading />
  }
);

export const DynamicGalleryApp = dynamic(
  () => import("@/components/applications/GalleryApp").then((mod) => mod.GalleryApp),
  {
    loading: () => <WindowAppLoading />
  }
);

export const DynamicVideoApp = dynamic(
  () => import("@/components/applications/VideoApp").then((mod) => mod.VideoApp),
  {
    loading: () => <WindowAppLoading />
  }
);

export const DynamicContactApp = dynamic(
  () => import("@/components/applications/ContactApp").then((mod) => mod.ContactApp),
  {
    loading: () => <WindowAppLoading />
  }
);

export const DynamicCvApp = dynamic(
  () => import("@/components/applications/CvApp").then((mod) => mod.CvApp),
  {
    loading: () => <WindowAppLoading />
  }
);

export const DynamicSystemAlert = dynamic(
  () => import("@/components/applications/SystemAlert").then((mod) => mod.SystemAlert),
  {
    loading: () => <WindowAppLoading />
  }
);

export const DynamicMediaViewer = dynamic(
  () => import("@/components/ui/MediaViewer").then((mod) => mod.MediaViewer),
  {
    loading: () => <WindowAppLoading />
  }
);

export const DynamicToolInfoApp = dynamic(
  () => import("@/components/applications/ToolInfoApp").then((mod) => mod.ToolInfoApp),
  {
    loading: () => <WindowAppLoading />
  }
);

export const DynamicNotesApp = dynamic(
  () => import("@/components/applications/NotesApp").then((mod) => mod.NotesApp),
  {
    loading: () => <WindowAppLoading />
  }
);

export const DynamicTrashApp = dynamic(
  () => import("@/components/applications/TrashApp").then((mod) => mod.TrashApp),
  {
    loading: () => <WindowAppLoading />
  }
);
