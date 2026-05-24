/**
 * UI Store
 *
 * OWNERSHIP: Ephemeral UI interaction state
 * PERSISTENCE: Non-persistent (reset on project switch)
 * MUTABILITY: Mutable (user interactions)
 *
 * Responsibilities:
 * - Track current selections (clips, tracks)
 * - Manage preview mode (program vs source)
 * - Handle source mode state (in/out points)
 * - UI-only state that doesn't affect render output
 *
 * Does NOT:
 * - Persist to disk (intentionally ephemeral)
 * - Own timeline data (timelineStore owns that)
 * - Manage runtime resources (ProjectSession handles that)
 *
 * Architecture principle:
 * This is session-scoped interaction state. It's reset by ProjectSession
 * on project switch because selections don't carry across projects.
 *
 * Future consideration:
 * Some "UI" state may become workspace state (layouts, bookmarks, etc.)
 * and should migrate to a separate persistentWorkspaceStore.
 */

import { create } from "zustand";
import type { MediaAsset, TransformState } from "@/types";

const SELECT_TRACE = import.meta.env.DEV;
const traceSelect = (...args: unknown[]) => {
  if (!SELECT_TRACE) return;
  console.log("[SelectTrace][UIStore]", ...args);
};

interface UIStore {
  selectedClipIds: string[]; // Multi-select support
  selectedTrackId: string | null;
  // Note: previewMediaId is used for MediaPanel selection state only.
  previewMediaId: string | null;
  activePanel: "media" | "properties";
  showExportModal: boolean;
  showNewProjectModal: boolean;
  showSettingsModal: boolean;

  previewMode: "program" | "source";
  sourceAsset: (Omit<MediaAsset, "type"> & { type: "video" | "audio" | "image" | "text" }) | null;
  sourceTextPreset: any | null;
  sourceInPoint: number | null;
  sourceOutPoint: number | null;

  // Transform tool state
  activeTransform: TransformState | null;
  transformMode: "select" | "transform" | null;

  // Preview viewport state (editor-only, NOT exported)
  previewViewport: {
    zoom: number; // 0.1 to 5.0 (10% to 500%)
    panX: number; // Screen space offset (pixels)
    panY: number; // Screen space offset (pixels)
  };

  selectClip: (clipId: string | null) => void;
  toggleClipSelection: (clipId: string) => void;
  clearSelection: () => void;
  selectTrack: (trackId: string | null) => void;
  setPreviewMedia: (mediaId: string | null) => void;
  setActivePanel: (panel: "media" | "properties") => void;
  toggleExportModal: () => void;
  toggleNewProjectModal: () => void;
  toggleSettingsModal: () => void;

  // Preview mode actions
  previewAsset: (asset: MediaAsset) => void;
  previewTextPreset: (preset: any, type: "effect" | "template") => void;
  exitSourceMode: () => void;
  markSourceIn: (time: number | null) => void;
  markSourceOut: (time: number | null) => void;

  // Transform tool actions
  startTransform: (state: TransformState) => void;
  updateTransform: (state: TransformState) => void;
  endTransform: () => void;
  setTransformMode: (mode: "select" | "transform" | null) => void;

  // Preview viewport actions (editor-only zoom/pan)
  setPreviewZoom: (zoom: number) => void;
  setPreviewPan: (panX: number, panY: number) => void;
  resetPreviewViewport: () => void;
  zoomPreviewToFit: (canvasWidth: number, canvasHeight: number, viewportWidth: number, viewportHeight: number) => void;
}

const PREVIEW_ZOOM_MIN = 0.1;
const PREVIEW_ZOOM_MAX = 5.0;
const PREVIEW_ZOOM_SNAP_EPSILON = 0.005; // tight band so wheel remains responsive

export const useUIStore = create<UIStore>((set, get) => ({
  selectedClipIds: [],
  selectedTrackId: null,
  previewMediaId: null,
  activePanel: "media",
  showExportModal: false,
  showNewProjectModal: false,
  showSettingsModal: false,

  previewMode: "program",
  sourceAsset: null,
  sourceTextPreset: null,
  sourceInPoint: null,
  sourceOutPoint: null,

  // Transform tool state
  activeTransform: null,
  transformMode: null,

  // Preview viewport state (editor-only)
  previewViewport: {
    zoom: 1.0,
    panX: 0,
    panY: 0,
  },

  selectClip: (clipId) => {
    traceSelect("selectClip", { clipId, prev: get().selectedClipIds });
    set({ selectedClipIds: clipId ? [clipId] : [] });
  },

  toggleClipSelection: (clipId) => {
    set((state) => {
      const already = state.selectedClipIds.includes(clipId);
      traceSelect("toggleClipSelection", { clipId, already, prev: state.selectedClipIds });
      return {
        selectedClipIds: already ? state.selectedClipIds.filter((id) => id !== clipId) : [...state.selectedClipIds, clipId],
      };
    });
  },

  clearSelection: () => {
    traceSelect("clearSelection", { prev: get().selectedClipIds });
    set({ selectedClipIds: [] });
  },

  selectTrack: (trackId) => {
    set({ selectedTrackId: trackId });
  },

  setPreviewMedia: (mediaId) => {
    set({ previewMediaId: mediaId });
  },

  setActivePanel: (panel) => {
    set({ activePanel: panel });
  },

  toggleExportModal: () => {
    set((state) => ({
      showExportModal: !state.showExportModal,
    }));
  },

  toggleNewProjectModal: () => {
    set((state) => ({
      showNewProjectModal: !state.showNewProjectModal,
    }));
  },

  toggleSettingsModal: () => {
    set((state) => ({
      showSettingsModal: !state.showSettingsModal,
    }));
  },

  // Preview mode actions
  // NOTE: Transport context switching (program ↔ source) is handled
  // by the consuming component via session.transportAuthority.setActiveContext().
  // This store only manages UI state (which panel is shown, in/out points).
  previewAsset: (asset) => {
    set({
      previewMode: "source",
      sourceAsset: asset as any,
      sourceInPoint: null,
      sourceOutPoint: null,
      previewMediaId: asset.id,
    });
  },

  previewTextPreset: (preset, type) => {
    set({
      previewMode: "source",
      sourceAsset: {
        id: preset.id,
        name: preset.name || preset.defaultText || "Text",
        type: "text",
        path: "",
        duration: 3.0,
        size: 0,
      } as any,
      sourceTextPreset: { ...preset, presetType: type },
      sourceInPoint: null,
      sourceOutPoint: null,
      previewMediaId: preset.id,
    });
  },

  exitSourceMode: () => {
    set({
      previewMode: "program",
      sourceAsset: null,
      sourceTextPreset: null,
      sourceInPoint: null,
      sourceOutPoint: null,
      previewMediaId: null,
    });
  },

  markSourceIn: (time) => {
    set({ sourceInPoint: time });
  },

  markSourceOut: (time) => {
    set({ sourceOutPoint: time });
  },

  // Transform tool actions
  startTransform: (state) => {
    traceSelect("startTransform", { clipId: state.clipId, handle: state.handle, selected: get().selectedClipIds });
    set({ activeTransform: state, transformMode: "transform" });
  },

  updateTransform: (state) => {
    set({ activeTransform: state });
  },

  endTransform: () => {
    traceSelect("endTransform", { activeTransform: get().activeTransform, selected: get().selectedClipIds });
    set({ activeTransform: null, transformMode: "select" });
  },

  setTransformMode: (mode) => {
    set({ transformMode: mode });
  },

  // Preview viewport actions (editor-only zoom/pan)
  setPreviewZoom: (zoom) => {
    const prevZoom = get().previewViewport.zoom;
    let clamped = Math.max(PREVIEW_ZOOM_MIN, Math.min(PREVIEW_ZOOM_MAX, zoom));
    // Magnetic snap around fit zoom (1.0 in current preview viewport model).
    // Snap only when crossing near fit or landing very close from a non-near state.
    const prevNearFit = Math.abs(prevZoom - 1.0) <= PREVIEW_ZOOM_SNAP_EPSILON;
    const nextNearFit = Math.abs(clamped - 1.0) <= PREVIEW_ZOOM_SNAP_EPSILON;
    const crossedFit = (prevZoom < 1.0 && clamped > 1.0) || (prevZoom > 1.0 && clamped < 1.0);
    if (nextNearFit && (crossedFit || !prevNearFit)) {
      clamped = 1.0;
    }
    set((state) => ({
      previewViewport: { ...state.previewViewport, zoom: clamped },
    }));
  },

  setPreviewPan: (panX, panY) => {
    set((state) => ({
      previewViewport: { ...state.previewViewport, panX, panY },
    }));
  },

  resetPreviewViewport: () => {
    set({
      previewViewport: { zoom: 1.0, panX: 0, panY: 0 },
    });
  },

  zoomPreviewToFit: (canvasWidth, canvasHeight, viewportWidth, viewportHeight) => {
    const scaleX = viewportWidth / canvasWidth;
    const scaleY = viewportHeight / canvasHeight;
    const zoom = Math.min(scaleX, scaleY, 1.0); // Never zoom in beyond 100%
    set({
      previewViewport: { zoom, panX: 0, panY: 0 },
    });
  },
}));
