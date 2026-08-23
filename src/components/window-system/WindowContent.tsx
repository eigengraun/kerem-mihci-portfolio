"use client";

import React, { useRef, useEffect } from "react";

interface WindowContentProps {
  children: React.ReactNode;
  scrollTop?: number;
  onScroll?: (scrollTop: number) => void;
  isDarkTool?: boolean;
  isDarkTheme?: boolean;
}

export const WindowContent: React.FC<WindowContentProps> = ({
  children,
  scrollTop = 0,
  onScroll,
  isDarkTool = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && scrollTop > 0) {
      containerRef.current.scrollTop = scrollTop;
    }
  }, [scrollTop]);

  const handleScroll = () => {
    if (containerRef.current && onScroll) {
      onScroll(containerRef.current.scrollTop);
    }
  };

  const bgClass = isDarkTool
    ? "bg-[#2C2B2B] text-[#ECECEC] p-3.5 md:p-4 overflow-y-hidden"
    : "flex-1 bg-[var(--app-surface)] text-[var(--app-text-primary)] p-3 md:p-4 overflow-y-auto app-scrollbar transition-colors duration-200";

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={`w-full rounded-b-xl focus:outline-none ${bgClass}`}
    >
      {children}
    </div>
  );
};
