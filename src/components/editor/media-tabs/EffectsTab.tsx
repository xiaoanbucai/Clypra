import React, { useState, useEffect } from "react";
import { Wand2, Search, Plus, AlertCircle, CheckCircle, Download, Loader2, Sparkles, User, Film } from "lucide-react";
import type { TabProps } from "./types";
import { useVideoEffectsStore } from "@/features/video-effects/store/videoEffectsStore";
import type { EffectPreset, OverlayAsset } from "@/features/video-effects/types";
import { VideoEffectsApi } from "@/features/video-effects/api/clypraApi";
import { useProjectStore } from "@/store/projectStore";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";

type EffectCategory = "video" | "body" | "overlays";

export const EffectsTab: React.FC<TabProps> = ({ onAddToTimeline }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<EffectCategory>("video");
  const [videoEffects, setVideoEffects] = useState<EffectPreset[]>([]);
  const [bodyEffects, setBodyEffects] = useState<EffectPreset[]>([]);
  const [overlays, setOverlays] = useState<OverlayAsset[]>([]);
  const [localOverlays, setLocalOverlays] = useState<OverlayAsset[]>([]);
  const [overlayCategories, setOverlayCategories] = useState<Array<{ id: string; name: string; count: number }>>([]);
  const [activeOverlayCategory, setActiveOverlayCategory] = useState<string>("fire");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingLocal, setUploadingLocal] = useState(false);

  // Initialize cache on mount
  useEffect(() => {
    useVideoEffectsStore.getState().initializeCache();
  }, []);

  // Fetch effects and overlay categories
  useEffect(() => {
    const fetchEffects = async () => {
      setLoading(true);
      setError(null);

      try {
        const [video, body, overlaysManifest] = await Promise.all([VideoEffectsApi.getVideoEffects(), VideoEffectsApi.getBodyEffects(), VideoEffectsApi.getOverlaysManifest()]);
        setVideoEffects(video);
        setBodyEffects(body);
        setOverlayCategories(overlaysManifest.categories);
      } catch (err) {
        console.error("[EffectsTab] Failed to load effects:", err);
        setError(err instanceof Error ? err.message : "Failed to load effects");
      } finally {
        setLoading(false);
      }
    };

    fetchEffects();
  }, []);

  // Fetch overlays when overlay category changes
  useEffect(() => {
    if (activeCategory !== "overlays") return;

    const fetchOverlays = async () => {
      setLoading(true);
      setError(null);

      try {
        const overlaysData = await VideoEffectsApi.getOverlaysByCategory(activeOverlayCategory);
        setOverlays(overlaysData);
      } catch (err) {
        console.error("[EffectsTab] Failed to load overlays:", err);
        setError(err instanceof Error ? err.message : "Failed to load overlays");
      } finally {
        setLoading(false);
      }
    };

    fetchOverlays();
  }, [activeCategory, activeOverlayCategory]);

  const currentEffects = activeCategory === "video" ? videoEffects : activeCategory === "body" ? bodyEffects : [...localOverlays, ...overlays];
  const effectType = activeCategory === "video" ? "video-effects" : activeCategory === "body" ? "body-effects" : "animated-overlays";

  // Handle local video file upload for overlays
  const handleLocalOverlayUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingLocal(true);

    try {
      // Read video metadata
      const video = document.createElement("video");
      const objectUrl = URL.createObjectURL(file);

      await new Promise((resolve, reject) => {
        video.preload = "metadata";
        video.onloadedmetadata = resolve;
        video.onerror = reject;
        video.src = objectUrl;
      });

      const duration = video.duration;
      const width = video.videoWidth;
      const height = video.videoHeight;

      // Extract thumbnail
      video.currentTime = Math.min(duration / 2, 1);
      await new Promise((resolve) => {
        video.onseeked = resolve;
      });

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(video, 0, 0);
      const thumbnail = canvas.toDataURL("image/jpeg", 0.8);

      URL.revokeObjectURL(objectUrl);

      // Create local overlay asset
      const localOverlay: OverlayAsset = {
        id: `local-${Date.now()}`,
        name: file.name.replace(/\.[^.]+$/, ""),
        type: "overlay",
        category: "local",
        url: URL.createObjectURL(file), // Use object URL for local file
        thumbnail,
        duration,
        width,
        height,
        hasAlpha: true,
        fileFormat: file.name.toLowerCase().endsWith(".webm") ? "webm" : file.name.toLowerCase().endsWith(".mov") ? "mov" : "mp4",
        fileSize: file.size,
        blendMode: "screen",
        tags: ["local", "test"],
        description: "Local test overlay",
        recommended: {
          opacity: 0.7,
          blendMode: "screen",
          placement: "overlay",
        },
        loopable: true,
        _isLocal: true, // Flag to indicate this is a local file
        _localFile: file, // Store the file for later use
      } as any;

      setLocalOverlays((prev) => [localOverlay, ...prev]);
      useProjectStore.getState().showToast(`Added local overlay: ${localOverlay.name}`);
    } catch (error) {
      console.error("[EffectsTab] Failed to process local overlay:", error);
      useProjectStore.getState().showToast("Failed to process video file", "error");
    } finally {
      setUploadingLocal(false);
      // Reset input
      event.target.value = "";
    }
  };

  const filteredEffects = currentEffects.filter((effect) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return effect.name.toLowerCase().includes(query) || effect.description.toLowerCase().includes(query) || (effect as any).renderer?.toLowerCase().includes(query) || effect.tags?.some((tag) => tag.toLowerCase().includes(query));
  });

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-surface/5 select-none">
      <div className="flex items-center gap-2.5 p-1 border-b border-border/50 shrink-0 bg-surface/10">
        <div className="shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-sm bg-accent/10 border border-accent/20 text-accent-soft">
          <Wand2 className="w-3.5 h-3.5" />
          <span className="text-[12px] font-semibold">Effects</span>
        </div>
        <div className="w-px h-5 bg-border/80 shrink-0" />
        <div className="grow overflow-x-auto flex items-center gap-2 pb-0.5 whitespace-nowrap" style={{ scrollbarWidth: "none" }}>
          <button onClick={() => setActiveCategory("video")} className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${activeCategory === "video" ? "bg-accent text-white shadow-sm" : "text-text-muted hover:text-text-primary hover:bg-surface-raised/60"}`}>
            <Sparkles className="w-3 h-3" />
            Video
          </button>
          <button onClick={() => setActiveCategory("body")} className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${activeCategory === "body" ? "bg-accent text-white shadow-sm" : "text-text-muted hover:text-text-primary hover:bg-surface-raised/60"}`}>
            <User className="w-3 h-3" />
            Body
          </button>
          <button onClick={() => setActiveCategory("overlays")} className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${activeCategory === "overlays" ? "bg-accent text-white shadow-sm" : "text-text-muted hover:text-text-primary hover:bg-surface-raised/60"}`}>
            <Film className="w-3 h-3" />
            Overlays
          </button>
        </div>
      </div>

      {/* Overlay Subcategories */}
      {activeCategory === "overlays" && overlayCategories.length > 0 && (
        <div className="p-1 border-b border-border/50 bg-surface/5">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
            {/* Local Upload Button */}
            <label className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer shrink-0 bg-violet-500/20 text-violet-300 border border-violet-500/40 hover:bg-violet-500/30 flex items-center gap-1.5">
              <input type="file" accept="video/webm,video/mp4,video/quicktime,.webm,.mp4,.mov" onChange={handleLocalOverlayUpload} className="hidden" disabled={uploadingLocal} />
              {uploadingLocal ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3 h-3" />
                  <span>Upload Local</span>
                </>
              )}
            </label>

            {/* Category Buttons */}
            {overlayCategories.map((cat) => (
              <button key={cat.id} onClick={() => setActiveOverlayCategory(cat.id)} className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer shrink-0 ${activeOverlayCategory === cat.id ? "bg-accent/20 text-accent border border-accent/40" : "text-text-muted hover:text-text-primary hover:bg-surface-raised/40"}`}>
                {cat.name} ({cat.count})
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="p-1 border-b border-border/50 bg-surface/5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input type="text" placeholder={`Search ${activeCategory} effects...`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-surface-raised/70 border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent" />
        </div>
      </div>

      <div className="grow overflow-y-auto scrollbar-thin p-1" style={{ scrollbarWidth: "none" }}>
        {error && (
          <div className="mb-3 p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-red-200 flex items-start gap-2.5 text-xs">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Failed to load effects</p>
              <p className="opacity-80 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 gap-2">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : filteredEffects.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center text-text-muted gap-1 text-xs">
            <Wand2 className="w-5 h-5" />
            <p>No matching effects found</p>
            <p className="opacity-60">Try another search or category</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">{filteredEffects.map((effect) => (activeCategory === "overlays" ? <OverlayCard key={effect.id} overlay={effect as OverlayAsset} onAddToTimeline={() => onAddToTimeline?.(effect as any, effectType)} /> : <EffectCard key={effect.id} effect={effect as EffectPreset} effectType={effectType} onAddToTimeline={() => onAddToTimeline?.(effect as any, effectType)} />))}</div>
        )}
      </div>
    </div>
  );
};

const SkeletonCard = () => (
  <div className="animate-pulse rounded-lg border border-border/30 bg-surface-raised/40 overflow-hidden flex flex-col justify-between">
    <div className="h-28 bg-white/5 relative overflow-hidden">
      <div className="absolute right-2 top-2 h-5 w-12 rounded bg-white/10" />
    </div>
    <div className="p-2.5 space-y-2 flex-1 flex flex-col justify-between">
      <div className="space-y-2">
        <div className="h-3.5 bg-white/10 rounded w-3/4" />
        <div className="h-3 bg-white/5 rounded w-full" />
        <div className="h-3 bg-white/5 rounded w-5/6" />
      </div>
      <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/5">
        <div className="h-2.5 bg-white/5 rounded w-1/3" />
        <div className="h-2.5 bg-white/5 rounded w-1/4" />
      </div>
    </div>
  </div>
);

const EffectCard: React.FC<{ effect: EffectPreset; effectType: string; onAddToTimeline: () => void }> = ({ effect, effectType, onAddToTimeline }) => {
  const { getEffectDownloadState, startEffectDownload, isEffectDownloaded } = useVideoEffectsStore();

  const downloadState = getEffectDownloadState(effect.id);
  const isDownloadedFlag = isEffectDownloaded(effect.id);
  const isDownloading = downloadState?.status === "downloading";

  const previewSrc = effect.thumbnail || "/effect-previews/sample.jpg";
  const isBodyEffect = effectType === "body-effects";

  // Handle clicking card - apply effect directly
  const handleCardClick = async () => {
    if (isDownloading) return;

    try {
      console.log(`[EffectCard] Applying effect "${effect.name}"`);

      const downloadPromise = startEffectDownload(effect);
      const delayPromise = new Promise((resolve) => setTimeout(resolve, 300));

      await Promise.all([downloadPromise, delayPromise]);
      console.log(`[EffectCard] Effect "${effect.name}" downloaded successfully`);

      onAddToTimeline();
      console.log(`[EffectCard] Effect "${effect.name}" added to timeline`);

      useProjectStore.getState().showToast(`Applied ${effect.name} effect`);
    } catch (error) {
      console.error("[EffectCard] Apply failed:", error);
      useProjectStore.getState().showToast("Failed to apply effect", "error");
    }
  };

  const handleAddToTimeline = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await handleCardClick();
  };

  return (
    <div onClick={handleCardClick} className={`group text-left rounded-xl border bg-surface-raised/40 transition-all overflow-hidden flex flex-col h-[200px] shadow-[0_4px_16px_rgba(0,0,0,0.3)] hover:bg-surface-raised/80 hover:border-accent/40 cursor-pointer ${isDownloading ? "border-accent/60" : "border-border/40"}`}>
      {/* Downloading Overlay */}
      {isDownloading && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-20 pointer-events-none">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 text-accent animate-spin" />
            <span className="text-[10px] font-semibold text-accent">{downloadState?.progress || 0}%</span>
          </div>
        </div>
      )}

      {/* Preview Area */}
      <div className="h-28 w-full relative overflow-hidden bg-surface/60 shrink-0">
        {/* Cached Indicator */}
        {isDownloadedFlag && !isDownloading && (
          <div className="absolute top-2 right-2 z-10">
            <div className="bg-green-500/90 rounded-full p-0.5 shadow-md">
              <CheckCircle className="w-3 h-3 text-white" />
            </div>
          </div>
        )}

        {/* Preview Image */}
        <img
          src={previewSrc}
          alt={`${effect.name} preview`}
          className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
          loading="lazy"
          onError={(e) => {
            const img = e.target as HTMLImageElement;
            img.style.display = "none";
          }}
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />

        {/* Effect Type Badge */}
        <div className={`absolute bottom-2 left-2 px-2 py-0.5 rounded-full backdrop-blur-sm border ${isBodyEffect ? "bg-purple-500/80 border-white/20" : "bg-black/60 border-white/10"}`}>
          <span className="text-[9px] font-semibold text-white uppercase tracking-wide">{isBodyEffect ? "Body Tracked" : effect.renderer}</span>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-2 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2">
            <p className="text-[13px] font-semibold text-text-primary leading-tight truncate">{effect.name}</p>

            {/* Add to Timeline Button */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={handleAddToTimeline} disabled={isDownloading} className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${isDownloading ? "bg-accent/20 border border-accent cursor-wait" : isDownloadedFlag ? "bg-accent/20 hover:bg-accent border border-accent text-accent hover:text-white cursor-pointer" : "bg-surface/40 hover:bg-accent/80 border border-border/50 text-text-muted hover:text-white cursor-pointer"}`}>
                    {isDownloading ? <Download className="w-3.5 h-3.5 animate-pulse" /> : <Plus className="w-3.5 h-3.5" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>{isDownloadedFlag ? "Add to Timeline" : "Download & Add"}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-text-muted line-clamp-2">{effect.description}</p>
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-1.5">
          <span className="text-[10px] capitalize text-text-muted group-hover:text-text-primary transition-colors truncate mr-1">{effect.category}</span>
          {effect.intensity && <span className="text-[10px] text-text-muted shrink-0">{effect.intensity.default}%</span>}
        </div>
      </div>
    </div>
  );
};

const OverlayCard: React.FC<{ overlay: OverlayAsset; onAddToTimeline: () => void }> = ({ overlay, onAddToTimeline }) => {
  const { getOverlayVideoDownloadState, startOverlayVideoDownload, isOverlayVideoDownloaded } = useVideoEffectsStore();

  // Check if this is a local overlay
  const isLocal = (overlay as any)._isLocal === true;

  const downloadState = isLocal ? null : getOverlayVideoDownloadState(overlay.id);
  const isDownloadedFlag = isLocal ? true : isOverlayVideoDownloaded(overlay.id);
  const isDownloading = downloadState?.status === "downloading";

  const previewSrc = overlay.thumbnail || "/effect-previews/sample.jpg";

  // Handle clicking card - download and apply overlay (or directly apply if local)
  const handleCardClick = async () => {
    if (isDownloading) return;

    try {
      console.log(`[OverlayCard] Applying overlay "${overlay.name}"`);

      if (!isLocal) {
        // Remote overlay - download first
        const downloadPromise = startOverlayVideoDownload(overlay);
        const delayPromise = new Promise((resolve) => setTimeout(resolve, 300));

        await Promise.all([downloadPromise, delayPromise]);
        console.log(`[OverlayCard] Overlay "${overlay.name}" downloaded successfully`);
      }

      onAddToTimeline();
      console.log(`[OverlayCard] Overlay "${overlay.name}" added to timeline`);

      useProjectStore.getState().showToast(`Applied ${overlay.name} overlay`);
    } catch (error) {
      console.error("[OverlayCard] Apply failed:", error);
      useProjectStore.getState().showToast("Failed to apply overlay", "error");
    }
  };

  const handleAddToTimeline = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await handleCardClick();
  };

  return (
    <div onClick={handleCardClick} className={`group text-left rounded-xl border bg-surface-raised/40 transition-all overflow-hidden flex flex-col h-[200px] shadow-[0_4px_16px_rgba(0,0,0,0.3)] hover:bg-surface-raised/80 hover:border-accent/40 cursor-pointer ${isDownloading ? "border-accent/60" : "border-border/40"}`}>
      {/* Downloading Overlay */}
      {isDownloading && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-20 pointer-events-none">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 text-accent animate-spin" />
            <span className="text-[10px] font-semibold text-accent">{downloadState?.progress || 0}%</span>
          </div>
        </div>
      )}

      {/* Preview Area */}
      <div className="h-28 w-full relative overflow-hidden bg-surface/60 shrink-0">
        {/* Local Badge or Cached Indicator */}
        {isLocal ? (
          <div className="absolute top-2 right-2 z-10">
            <div className="bg-violet-500/90 rounded-full px-2 py-0.5 shadow-md">
              <span className="text-[9px] font-semibold text-white uppercase">Local</span>
            </div>
          </div>
        ) : isDownloadedFlag && !isDownloading ? (
          <div className="absolute top-2 right-2 z-10">
            <div className="bg-green-500/90 rounded-full p-0.5 shadow-md">
              <CheckCircle className="w-3 h-3 text-white" />
            </div>
          </div>
        ) : null}

        {/* Preview Image */}
        <img
          src={previewSrc}
          alt={`${overlay.name} preview`}
          className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
          loading="lazy"
          onError={(e) => {
            const img = e.target as HTMLImageElement;
            img.style.display = "none";
          }}
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />

        {/* Overlay Type Badge */}
        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full backdrop-blur-sm border bg-violet-600/80 border-white/20">
          <span className="text-[9px] font-semibold text-white uppercase tracking-wide">{overlay.loopable ? "Looping" : "Once"}</span>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-2 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2">
            <p className="text-[13px] font-semibold text-text-primary leading-tight truncate">{overlay.name}</p>

            {/* Add to Timeline Button */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={handleAddToTimeline} disabled={isDownloading} className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${isDownloading ? "bg-accent/20 border border-accent cursor-wait" : isDownloadedFlag ? "bg-accent/20 hover:bg-accent border border-accent text-accent hover:text-white cursor-pointer" : "bg-surface/40 hover:bg-accent/80 border border-border/50 text-text-muted hover:text-white cursor-pointer"}`}>
                    {isDownloading ? <Download className="w-3.5 h-3.5 animate-pulse" /> : <Plus className="w-3.5 h-3.5" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>{isLocal ? "Add to Timeline" : isDownloadedFlag ? "Add to Timeline" : "Download & Add"}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-text-muted line-clamp-2">{overlay.description}</p>
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-1.5">
          <span className="text-[10px] capitalize text-text-muted group-hover:text-text-primary transition-colors truncate mr-1">{overlay.category}</span>
          <span className="text-[10px] text-text-muted shrink-0">{overlay.duration.toFixed(1)}s</span>
        </div>
      </div>
    </div>
  );
};
