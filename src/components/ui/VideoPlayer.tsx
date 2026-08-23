"use client";

import React, { useRef, useEffect } from "react";

interface VideoPlayerProps {
  src: string;
  poster?: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, poster }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    return () => {
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
    };
  }, []);

  return (
    <div className="relative w-full overflow-hidden bg-black rounded-lg shadow-inner">
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        controls
        playsInline
        preload="metadata"
        className="w-full h-auto max-h-[70vh] object-contain mx-auto"
      >
        Your browser does not support HTML5 video playback.
      </video>
    </div>
  );
};
