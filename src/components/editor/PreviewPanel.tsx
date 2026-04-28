import React, { useRef, useEffect, useState } from "react";
import { Volume2, VolumeX, SkipBack, ChevronLeft, Circle, ChevronRight, SkipForward } from "lucide-react";
import { Button } from "../ui/Button";
import { usePlayback } from "../../hooks/usePlayback";
import { useProjectStore } from "../../store/projectStore";
import { useUIStore } from "../../store/uiStore";

export const PreviewPanel: React.FC = () => {
  const { isPlaying, currentTime, duration, frameRate, play, pause, seek, formatTime } = usePlayback();
  const { project, mediaAssets } = useProjectStore();
  const { previewMediaId } = useUIStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    console.log("[PreviewPanel] Component mounted, project:", project);

    const updateDimensions = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        console.log("[PreviewPanel] Container dimensions:", { clientWidth, clientHeight });
        setDimensions({
          width: clientWidth,
          height: clientHeight,
        });
      }
    };

    // Use ResizeObserver for better dimension tracking
    const resizeObserver = new ResizeObserver((entries) => {
      console.log("[PreviewPanel] ResizeObserver triggered");
      updateDimensions();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
      // Initial update with a small delay to ensure layout is complete
      setTimeout(updateDimensions, 0);
      setTimeout(updateDimensions, 100);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [project]);

  useEffect(() => {
    console.log("[PreviewPanel] Dimensions updated:", dimensions);
  }, [dimensions]);

  if (!project) {
    console.log("[PreviewPanel] No project, returning null");
    return null;
  }

  const previewMedia = previewMediaId ? mediaAssets.find((asset) => asset.id === previewMediaId) : null;

  const canvasWidth = project.canvasWidth;
  const canvasHeight = project.canvasHeight;

  console.log("[PreviewPanel] Canvas dimensions from project:", { canvasWidth, canvasHeight });
  console.log("[PreviewPanel] Container dimensions state:", dimensions);

  // Only calculate if we have valid dimensions, otherwise show a loading state
  if (dimensions.width === 0 || dimensions.height === 0) {
    console.log("[PreviewPanel] Waiting for container dimensions...");
    return (
      <div className="flex-1 bg-surface flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          <div ref={containerRef} className="w-full h-full flex items-center justify-center">
            <div className="text-text-muted">Loading preview...</div>
          </div>
        </div>
      </div>
    );
  }

  const containerWidth = dimensions.width;
  const containerHeight = dimensions.height;

  const scale = Math.min(containerWidth / canvasWidth, containerHeight / canvasHeight);
  const displayWidth = canvasWidth * scale;
  const displayHeight = canvasHeight * scale;

  console.log("[PreviewPanel] Calculated display dimensions:", {
    scale,
    displayWidth,
    displayHeight,
    aspectRatio: displayWidth / displayHeight,
  });

  const handlePlayheadClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    const newTime = (relativeX / displayWidth) * duration;
    seek(newTime);
  };

  return (
    <div className="flex-1 bg-surface flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <div ref={containerRef} className="w-full h-full flex items-center justify-center">
          <div
            className="checkerboard rounded"
            style={{
              width: displayWidth,
              height: displayHeight,
            }}
          >
            <div className="w-full h-full bg-surface-raised flex items-center justify-center text-text-muted overflow-hidden relative">
              {previewMedia ? (
                previewMedia.type === "video" || previewMedia.type === "image" ? (
                  previewMedia.posterFrame ? (
                    <img src={previewMedia.posterFrame} alt={previewMedia.name} className="max-w-full max-h-full object-contain" />
                  ) : previewMedia.type === "image" ? (
                    <img src={previewMedia.path} alt={previewMedia.name} className="max-w-full max-h-full object-contain" />
                  ) : (
                    <video src={previewMedia.path} className="max-w-full max-h-full object-contain" controls={false} />
                  )
                ) : (
                  <div className="text-center z-10">
                    <div className="text-4xl mb-2">🎵</div>
                    <div className="text-sm">{previewMedia.name}</div>
                  </div>
                )
              ) : (
                "Preview"
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-accent">{project.aspectRatio}</span>
          <div className="text-sm text-text-primary">
            {Math.floor(displayWidth)}x{Math.floor(displayHeight)}
          </div>
        </div>

        <div className="h-8 bg-surface-raised rounded cursor-pointer relative border border-border" onClick={handlePlayheadClick}>
          <div className="absolute h-full bg-accent rounded opacity-30" style={{ width: `${(currentTime / duration) * 100}%` }} />
        </div>

        <div className="flex items-center justify-center gap-2">
          <Button variant="ghost" size="sm" icon={<SkipBack className="w-4 h-4" />} />
          <Button variant="ghost" size="sm" icon={<ChevronLeft className="w-4 h-4" />} />
          <Button variant="secondary" size="sm" className="px-3" icon={isPlaying ? <Circle className="w-5 h-5 fill-current" /> : <Circle className="w-5 h-5 fill-current" />} onClick={isPlaying ? pause : play} />
          <Button variant="ghost" size="sm" icon={<ChevronRight className="w-4 h-4" />} />
          <Button variant="ghost" size="sm" icon={<SkipForward className="w-4 h-4" />} />

          <div className="w-px h-6 bg-border mx-2" />

          <Button variant="ghost" size="sm" icon={isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />} onClick={() => setIsMuted(!isMuted)} />
          <input
            type="range"
            min="0"
            max="100"
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              setVolume(Number(e.target.value));
              if (Number(e.target.value) > 0) setIsMuted(false);
            }}
            className="w-24"
          />
        </div>
      </div>
    </div>
  );
};
