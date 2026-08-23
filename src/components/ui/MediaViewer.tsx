"use client";

import React, { useState } from "react";
import Image from "next/image";

interface MediaViewerProps {
  src?: string;
  title?: string;
}

export const MediaViewer: React.FC<MediaViewerProps> = ({
  src = "/assets/projects/alchemia/nov-2024.webp",
  title = "Media Preview"
}) => {
  const [zoom, setZoom] = useState(1);

  return (
    <div className="flex flex-col h-full space-y-3">
      <div className="flex items-center justify-between px-2 text-xs font-mono text-neutral-600 border-b border-black/10 pb-2">
        <span className="truncate">{title}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            className="px-2 py-0.5 rounded bg-white border border-black/10 hover:bg-neutral-100"
          >
            -
          </button>

          <span>{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2.5, z + 0.25))}
            className="px-2 py-0.5 rounded bg-white border border-black/10 hover:bg-neutral-100"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="px-2 py-0.5 rounded bg-white border border-black/10 hover:bg-neutral-100"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="flex-1 relative w-full h-full min-h-[300px] overflow-auto flex items-center justify-center bg-neutral-900 rounded-lg p-2">
        <div
          className="transition-transform duration-150 ease-out"
          style={{ transform: `scale(${zoom})` }}
        >
          <Image
            src={src}
            alt={title}
            width={1000}
            height={700}
            className="max-w-full h-auto object-contain rounded"
          />
        </div>
      </div>
    </div>
  );
};
