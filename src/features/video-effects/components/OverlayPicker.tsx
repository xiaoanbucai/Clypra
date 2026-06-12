/**
 * Overlay Picker Component
 *
 * Allows users to browse and apply video overlay assets (smoke, fire, etc.)
 */

import React, { useState } from "react";
import { useOverlays, useManifest, OverlayAsset } from "../index";

interface OverlayPickerProps {
  onSelect: (overlay: OverlayAsset) => void;
}

export function OverlayPicker({ onSelect }: OverlayPickerProps) {
  const { manifest, loading: manifestLoading } = useManifest();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Get overlay categories from manifest
  const overlayCategories = manifest?.categories.filter((cat) => cat.type === "overlay") || [];

  // Load overlays for selected category
  const { overlays, loading: overlaysLoading, error } = useOverlays(selectedCategory || overlayCategories[0]?.id || "");

  // Auto-select first category
  React.useEffect(() => {
    if (!selectedCategory && overlayCategories.length > 0) {
      setSelectedCategory(overlayCategories[0].id);
    }
  }, [overlayCategories, selectedCategory]);

  if (manifestLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        <p className="ml-3 text-sm text-zinc-400">Loading overlays...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Category Tabs */}
      <div className="flex gap-2 p-4 border-b border-zinc-800 overflow-x-auto">
        {overlayCategories.map((category) => (
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

      {/* Overlays Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-sm text-red-400">{error}</div>}

        {overlaysLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {overlays.map((overlay) => (
              <OverlayCard key={overlay.id} overlay={overlay} onSelect={() => onSelect(overlay)} />
            ))}
          </div>
        )}

        {!overlaysLoading && overlays.length === 0 && (
          <div className="text-center py-12 text-zinc-500">
            <p className="text-sm">No overlays in this category yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface OverlayCardProps {
  overlay: OverlayAsset;
  onSelect: () => void;
}

function OverlayCard({ overlay, onSelect }: OverlayCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button onClick={onSelect} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)} className="group relative bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 hover:border-blue-500 transition">
      {/* Thumbnail */}
      <div className="aspect-video relative overflow-hidden bg-zinc-950">
        <img src={overlay.thumbnail} alt={overlay.name} className="w-full h-full object-cover transition group-hover:scale-110" />

        {/* Premium Badge */}
        {overlay.isPremium && <div className="absolute top-2 right-2 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded">PRO</div>}

        {/* Duration Badge */}
        <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">{overlay.duration.toFixed(1)}s</div>

        {/* Preview on Hover */}
        {isHovered && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-medium text-sm text-white truncate">{overlay.name}</h3>
        <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{overlay.description}</p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mt-2">
          {overlay.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </div>

        {/* Properties */}
        <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
          {overlay.hasAlpha && (
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" />
              </svg>
              Alpha
            </span>
          )}
          {overlay.loopable && (
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
              Loop
            </span>
          )}
          <span>{(overlay.fileSize / 1024 / 1024).toFixed(1)}MB</span>
        </div>
      </div>
    </button>
  );
}
