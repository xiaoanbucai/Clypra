import React, { useEffect } from "react";
import { useTransportControls, useTransportSnapshot } from "./usePlaybackClock";
import { getActiveSessionOrNull } from "@/core/runtime/ProjectSession";
import { useTimelineStore } from "@/store/timelineStore";
import { useUIStore } from "@/store/uiStore";
import { useProjectStore } from "@/store/projectStore";
import { useHistoryStore } from "@/store/historyStore";
import { EditingActions } from "@/core/interactions";

export const useKeyboardShortcuts = () => {
  const { play, pause, seek, setActiveContext } = useTransportControls();
  const { state: transportState, time: transportTime, speed } = useTransportSnapshot();
  const { zoomLevel, setZoom, swapClips, rippleEditEnabled, toggleRippleEdit } = useTimelineStore();
  const { selectedClipIds, selectClip, selectTrack, previewMode, exitSourceMode, markSourceIn, markSourceOut } = useUIStore();
  const { project } = useProjectStore();
  const { undo, redo } = useHistoryStore();
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  const isPlaying = transportState === "playing";
  const frameRate = project?.frameRate ?? 30;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture shortcuts when typing in input fields
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      if (isTyping) return;

      const isMeta = e.ctrlKey || e.metaKey;

      // ─── Transport (context-aware) ───────────────────────────────────────

      if (e.code === "Space") {
        e.preventDefault();
        isPlaying ? pause() : play();
        return;
      }

      if (e.key === "k") {
        e.preventDefault();
        pause();
        return;
      }

      // ─── Seeking (context-aware) ─────────────────────────────────────────

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (previewMode === "source") {
          seek?.(Math.max(0, transportTime - 1));
        } else {
          const frameTime = 1 / frameRate;
          seek?.(Math.max(0, transportTime - frameTime));
        }
        return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (previewMode === "source") {
          seek?.(transportTime + 1);
        } else {
          const frameTime = 1 / frameRate;
          seek?.(transportTime + frameTime);
        }
        return;
      }

      // ─── Source mode shortcuts ───────────────────────────────────────────

      if (previewMode === "source") {
        if (e.key === "i") {
          e.preventDefault();
          const session = getActiveSessionOrNull();
          const t = session?.sourceContext?.getTime() ?? 0;
          markSourceIn(t);
          return;
        }

        if (e.key === "o") {
          e.preventDefault();
          const session = getActiveSessionOrNull();
          const t = session?.sourceContext?.getTime() ?? 0;
          markSourceOut(t);
          return;
        }

        if (e.key === "Escape") {
          e.preventDefault();
          exitSourceMode();
          setActiveContext?.("program");
          return;
        }

        // Don't process remaining shortcuts in source mode
        return;
      }

      // ─── Program mode shortcuts ──────────────────────────────────────────

      if (isMeta && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((isMeta && e.shiftKey && e.key === "z") || (isMeta && e.key === "y")) {
        e.preventDefault();
        redo();
      } else if (isMeta && e.key === "s") {
        e.preventDefault();
      } else if (isMeta && e.key === "i") {
        e.preventDefault();
      } else if (isMeta && e.shiftKey && e.key === "S") {
        e.preventDefault();
        const result = swapClips();
        if (result.error) {
          setToastMessage(result.error);
          setTimeout(() => setToastMessage(null), 3000);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        selectClip(null);
        selectTrack(null);
      } else if (isMeta && e.key === "=") {
        e.preventDefault();
        setZoom(Math.min(5, zoomLevel + 0.1));
      } else if (isMeta && e.key === "-") {
        e.preventDefault();
        setZoom(Math.max(0.5, zoomLevel - 0.1));
      } else if (e.key === "r" && !isMeta) {
        e.preventDefault();
        toggleRippleEdit();
        setToastMessage(rippleEditEnabled ? "Ripple Edit: OFF" : "Ripple Edit: ON");
        setTimeout(() => setToastMessage(null), 2000);
      } else if (e.key === "s" && !isMeta) {
        e.preventDefault();
        const results = EditingActions.splitAtPlayhead();

        if (results.length === 0) {
          setToastMessage("No clips under playhead to split");
        } else {
          const successCount = results.filter((r) => r.success).length;
          const failCount = results.length - successCount;

          if (successCount > 0) {
            setToastMessage(`Split ${successCount} clip${successCount > 1 ? "s" : ""}`);
          } else if (failCount > 0) {
            setToastMessage(results[0].error || "Split failed");
          }
        }
        setTimeout(() => setToastMessage(null), 2000);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, transportTime, frameRate, zoomLevel, selectedClipIds, previewMode, rippleEditEnabled, play, pause, seek, setActiveContext, setZoom, selectClip, selectTrack, exitSourceMode, markSourceIn, markSourceOut, swapClips, toggleRippleEdit, undo, redo]);

  return { toastMessage };
};
