import React, { useRef, useEffect, useState } from "react";
import { usePlaybackStore } from "../../../store/playbackStore";

interface PlayheadProps {
  pixelsPerSecond: number;
  duration: number;
}

export const Playhead: React.FC<PlayheadProps> = ({ pixelsPerSecond, duration }) => {
  const { currentTime, seek } = usePlaybackStore();
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const left = Math.max(0, currentTime * pixelsPerSecond);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const parent = containerRef.current?.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const newTime = Math.max(0, Math.min(x / pixelsPerSecond, duration));
      seek(newTime);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, duration, pixelsPerSecond, seek]);

  return (
    <div
      ref={containerRef}
      data-playhead
      className="absolute z-80 pointer-events-none inset-y-0"
      style={{
        left: `${left}px`,
        width: "2px",
        backgroundColor: "#f1f4f8",
        boxShadow: "0 0 0 1px rgba(0,0,0,0.25)",
      }}
    >
      <div
        className="absolute w-4 h-3 rounded-[2px] pointer-events-auto cursor-grab active:cursor-grabbing"
        style={{
          left: "-7px",
          top: "-5px",
          backgroundColor: "#f1f4f8",
          clipPath: "polygon(0 100%, 50% 0, 100% 100%)",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.35)",
        }}
        onMouseDown={() => setIsDragging(true)}
      />
    </div>
  );
};
