/**
 * Transition Picker Component
 *
 * Allows users to browse and apply transitions between clips
 */

import React, { useState } from "react";
import { useTransitions, useManifest, TransitionPreset } from "../index";

interface TransitionPickerProps {
  onSelect: (transition: TransitionPreset) => void;
}

export function TransitionPicker({ onSelect }: TransitionPickerProps) {
  const { manifest, loading: manifestLoading } = useManifest();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Get transition categories from manifest
  const transitionCategories = manifest?.categories.filter((cat) => cat.type === "transition") || [];

  // Load transitions for selected category
  const { transitions, loading: transitionsLoading, error } = useTransitions(selectedCategory || transitionCategories[0]?.id || "");

  // Auto-select first category
  React.useEffect(() => {
    if (!selectedCategory && transitionCategories.length > 0) {
      setSelectedCategory(transitionCategories[0].id);
    }
  }, [transitionCategories, selectedCategory]);

  if (manifestLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        <p className="ml-3 text-sm text-zinc-400">Loading transitions...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Category Tabs */}
      <div className="flex gap-2 p-4 border-b border-zinc-800 overflow-x-auto">
        {transitionCategories.map((category) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition
              ${selectedCategory === category.id ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}
            `}
          >
            {category.name}
          </button>
        ))}
      </div>

      {/* Transitions Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-sm text-red-400">{error}</div>}

        {transitionsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {transitions.map((transition) => (
              <TransitionCard key={transition.id} transition={transition} onSelect={() => onSelect(transition)} />
            ))}
          </div>
        )}

        {!transitionsLoading && transitions.length === 0 && (
          <div className="text-center py-12 text-zinc-500">
            <p className="text-sm">No transitions in this category yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface TransitionCardProps {
  transition: TransitionPreset;
  onSelect: () => void;
}

function TransitionCard({ transition, onSelect }: TransitionCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Get icon for transition renderer
  const getTransitionIcon = (renderer: string) => {
    const icons: Record<string, string> = {
      fade: "🌅",
      dissolve: "🌫️",
      zoom_in: "🔍",
      zoom_out: "🔎",
      slide_left: "⬅️",
      slide_right: "➡️",
      slide_up: "⬆️",
      slide_down: "⬇️",
      wipe_left: "↔️",
      wipe_right: "↔️",
      circle_expand: "⭕",
      glitch: "⚡",
      whip_pan: "💨",
    };
    return icons[renderer] || "🔄";
  };

  return (
    <button onClick={onSelect} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)} className="group relative bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 hover:border-blue-500 transition">
      {/* Preview */}
      <div className="aspect-video relative overflow-hidden bg-gradient-to-r from-zinc-950 via-zinc-800 to-zinc-950">
        <img src={transition.thumbnail} alt={transition.name} className="w-full h-full object-cover transition group-hover:scale-110" />

        {/* Premium Badge */}
        {transition.isPremium && <div className="absolute top-2 right-2 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded">PRO</div>}

        {/* Transition Icon */}
        <div className="absolute top-2 left-2 text-3xl">{getTransitionIcon(transition.renderer)}</div>

        {/* Duration Badge */}
        <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">{transition.duration.default}s</div>

        {/* Apply Button on Hover */}
        {isHovered && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium">Apply Transition</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-medium text-sm text-white truncate">{transition.name}</h3>
        <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{transition.description}</p>

        {/* Duration Range */}
        <div className="mt-2">
          <div className="flex justify-between text-xs text-zinc-500 mb-1">
            <span>Duration</span>
            <span>
              {transition.duration.min}s - {transition.duration.max}s
            </span>
          </div>
          <div className="h-1 bg-zinc-800 rounded-full" />
        </div>

        {/* Easing */}
        <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
          <span>Easing:</span>
          <span className="text-zinc-400">{transition.easing.replace(/-/g, " ")}</span>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mt-2">
          {transition.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}
