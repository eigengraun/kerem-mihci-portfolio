import React from "react";

export const WindowAppLoading: React.FC = () => {
  return (
    <div
      className="w-full h-full min-h-[260px] flex flex-col items-center justify-center p-8 select-none text-[var(--app-text-muted,#737373)] animate-in fade-in duration-150"
      aria-label="Loading application content"
      role="status"
    >
      <div className="w-5 h-5 rounded-full border-2 border-neutral-400/30 border-t-neutral-500 animate-spin" />
      <span className="sr-only">Loading...</span>
    </div>
  );
};
