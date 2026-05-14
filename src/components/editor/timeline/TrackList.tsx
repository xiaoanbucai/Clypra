import React, { useState } from "react";
import { Volume2, VolumeX, Lock, Unlock, Eye, EyeOff, X } from "lucide-react";
import { useTimelineStore } from "../../../store/timelineStore";
import { useUIStore } from "../../../store/uiStore";

interface TrackListProps {
  onEditTrack?: (trackId: string) => void;
}

export const TrackList: React.FC<TrackListProps> = ({ onEditTrack }) => {
  const { tracks, clips, removeTrack, toggleTrackLock, toggleTrackMute, toggleTrackVisibility } = useTimelineStore();
  const { selectedTrackId, selectTrack } = useUIStore();

  // Helper: Check if track has clips
  const trackHasClips = (trackId: string) => clips.some((c) => c.trackId === trackId);

  return (
    <div className="w-40 border-r border-timeline-track-border flex flex-col bg-timeline-track-bg">
      <div className="h-6 px-3 border-b border-timeline-track-border flex items-center shrink-0 panel-head">
        <span className="text-[11px] font-semibold tracking-wide text-timeline-track-label uppercase">Track</span>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {tracks.length === 0 ? (
          // Edge case: No tracks exist at all (rare, but possible)
          <div className="flex-1 flex items-center justify-center px-3">
            <span className="text-[10px] text-text-muted/40 text-center">No tracks</span>
          </div>
        ) : (
          tracks.map((track) => {
            const isEmpty = !trackHasClips(track.id);
            return (
              <div key={track.id} className={`group border-b border-timeline-track-border flex items-center gap-2 px-2 py-1 transition-colors ${selectedTrackId === track.id ? "bg-timeline-track-selected" : "hover:bg-timeline-track-hover"} ${isEmpty ? "opacity-60" : ""}`} style={{ height: `${track.height}px` }} onClick={() => selectTrack(track.id)} title={isEmpty ? `${track.name} (empty)` : track.name}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleTrackLock(track.id);
                  }}
                  className={`p-1 rounded transition-colors ${track.locked ? "bg-timeline-button-hover text-white" : "hover:bg-timeline-button-hover text-timeline-button-icon"}`}
                  aria-label={track.locked ? "Unlock track" : "Lock track"}
                >
                  {track.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleTrackVisibility(track.id);
                  }}
                  className={`p-1 rounded transition-colors ${track.visible ? "hover:bg-timeline-button-hover text-timeline-button-icon" : "bg-timeline-button-hover text-white"}`}
                  aria-label={track.visible ? "Hide track" : "Show track"}
                >
                  {track.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleTrackMute(track.id);
                  }}
                  className={`p-1 rounded transition-colors ${track.muted ? "bg-timeline-button-hover text-white" : "hover:bg-timeline-button-hover text-timeline-button-icon"}`}
                  aria-label={track.muted ? "Unmute track" : "Mute track"}
                >
                  {track.muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTrack(track.id);
                  }}
                  className="p-1 hover:bg-danger/20 rounded transition-colors opacity-0 group-hover:opacity-100"
                >
                  <X className="w-3 h-3 text-danger" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
