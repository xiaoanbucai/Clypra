/**
 * Main Effects Panel Component
 * Combines Overlays, Effects, and Transitions into a single tabbed interface
 */

import React, { useState } from "react";
import { OverlayPicker } from "./OverlayPicker";
import { EffectPicker } from "./EffectPicker";
import { TransitionPicker } from "./TransitionPicker";
import type { OverlayAsset, EffectPreset, TransitionPreset } from "../types";
import { useTimelineStore } from "@/store/timelineStore";
import { useUIStore } from "@/store/uiStore";

type EffectTab = "overlays" | "effects" | "transitions";

export function EffectsPanel() {
  const [activeTab, setActiveTab] = useState<EffectTab>("overlays");
  const selectedClipId = useUIStore((state) => state.selectedClipId);

  const handleOverlaySelect = async (overlay: OverlayAsset) => {
    if (!selectedClipId) {
      // Show toast or notification
      console.warn("No clip selected");
      return;
    }

    const { applyOverlayToClip } = await import("../utils/applyOverlay");
    await applyOverlayToClip(selectedClipId, overlay);
  };

  const handleEffectSelect = (effect: EffectPreset) => {
    if (!selectedClipId) {
      console.warn("No clip selected");
      return;
    }

    const { applyEffectToClip } = require("../utils/applyEffect");
    applyEffectToClip(selectedClipId, effect);
  };

  const handleTransitionSelect = (transition: TransitionPreset) => {
    const selectedClipIds = useUIStore.getState().selectedClipIds || [];

    if (selectedClipIds.length !== 2) {
      console.warn("Select exactly 2 adjacent clips");
      return;
    }

    const { applyTransitionBetweenClips } = require("../utils/applyTransition");
    try {
      applyTransitionBetweenClips(selectedClipIds[0], selectedClipIds[1], transition);
    } catch (error) {
      console.error("Failed to apply transition:", error);
    }
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      {/* Tab Headers */}
      <div className="flex border-b border-zinc-800">
        <button
          onClick={() => setActiveTab("overlays")}
          className={`
            flex-1 px-4 py-3 text-sm font-medium transition
            ${activeTab === "overlays" ? "text-blue-500 border-b-2 border-blue-500 bg-zinc-900" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"}
          `}
        >
          Overlays
        </button>
        <button
          onClick={() => setActiveTab("effects")}
          className={`
            flex-1 px-4 py-3 text-sm font-medium transition
            ${activeTab === "effects" ? "text-blue-500 border-b-2 border-blue-500 bg-zinc-900" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"}
          `}
        >
          Effects
        </button>
        <button
          onClick={() => setActiveTab("transitions")}
          className={`
            flex-1 px-4 py-3 text-sm font-medium transition
            ${activeTab === "transitions" ? "text-blue-500 border-b-2 border-blue-500 bg-zinc-900" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"}
          `}
        >
          Transitions
        </button>
      </div>

      {/* Selection Hint */}
      {!selectedClipId && activeTab !== "transitions" && <div className="px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20 text-xs text-yellow-400">Select a clip on the timeline to apply {activeTab}</div>}

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "overlays" && <OverlayPicker onSelect={handleOverlaySelect} />}
        {activeTab === "effects" && <EffectPicker onSelect={handleEffectSelect} />}
        {activeTab === "transitions" && <TransitionPicker onSelect={handleTransitionSelect} />}
      </div>
    </div>
  );
}
