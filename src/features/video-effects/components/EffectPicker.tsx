/**
 * Effect Picker Component
 *
 * Allows users to browse and apply behavior-driven effects (shake, blur, glitch, etc.)
 */

import React, { useState } from "react";
import { useEffects, useManifest, EffectPreset } from "../index";

interface EffectPickerProps {
  onSelect: (effect: EffectPreset) => void;
}

export function EffectPicker({ onSelect }: EffectPickerProps) {
  const { manifest, loading: manifestLoading } = useManifest();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Get effect categories from manifest
  const effectCategories = manifest?.categories.filter((cat) => cat.type === "effect") || [];

  // Load effects for selected category
  const { effects, loading: effectsLoading, error } = useEffects(selectedCategory || effectCategories[0]?.id || "");

  // Auto-select first category
  React.useEffect(() => {
    if (!selectedCategory && effectCategories.length > 0) {
      setSelectedCategory(effectCategories[0].id);
    }
  }, [effectCategories, selectedCategory]);

  if (manifestLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        <p className="ml-3 text-sm text-zinc-400">Loading effects...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Category Tabs */}
      <div className="flex gap-2 p-4 border-b border-zinc-800 overflow-x-auto">
        {effectCategories.map((category) => (
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

      {/* Effects Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-sm text-red-400">{error}</div>}

        {effectsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {effects.map((effect) => (
              <EffectCard key={effect.id} effect={effect} onSelect={() => onSelect(effect)} />
            ))}
          </div>
        )}

        {!effectsLoading && effects.length === 0 && (
          <div className="text-center py-12 text-zinc-500">
            <p className="text-sm">No effects in this category yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface EffectCardProps {
  effect: EffectPreset;
  onSelect: () => void;
}

function EffectCard({ effect, onSelect }: EffectCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Get icon for effect renderer
  const getEffectIcon = (renderer: string) => {
    const icons: Record<string, string> = {
      shake: "🎥",
      zoom: "🔍",
      blur: "🌫️",
      vhs: "📼",
      glitch: "⚡",
      rgb_split: "🌈",
      film_grain: "🎞️",
      flash: "💡",
      vignette: "🔦",
      pixelate: "🟦",
    };
    return icons[renderer] || "✨";
  };

  return (
    <button onClick={onSelect} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)} className="group relative bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 hover:border-blue-500 transition">
      {/* Preview */}
      <div className="aspect-video relative overflow-hidden bg-gradient-to-br from-zinc-950 to-zinc-900">
        <img src={effect.thumbnail} alt={effect.name} className="w-full h-full object-cover transition group-hover:scale-110" />

        {/* Premium Badge */}
        {effect.isPremium && <div className="absolute top-2 right-2 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded">PRO</div>}

        {/* Effect Icon */}
        <div className="absolute top-2 left-2 text-3xl">{getEffectIcon(effect.renderer)}</div>

        {/* Apply Button on Hover */}
        {isHovered && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium">Apply Effect</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-medium text-sm text-white truncate">{effect.name}</h3>
        <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{effect.description}</p>

        {/* Intensity Range */}
        <div className="mt-2">
          <div className="flex justify-between text-xs text-zinc-500 mb-1">
            <span>Intensity</span>
            <span>{effect.intensity.default}%</span>
          </div>
          <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 rounded-full" style={{ width: `${effect.intensity.default}%` }} />
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mt-2">
          {effect.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}
