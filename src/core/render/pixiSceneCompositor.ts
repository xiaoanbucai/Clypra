import {
  getSharedPixiRenderer,
  getOrCreateMediaSprite,
  applyMediaTransform,
  releaseMediaSprite,
  applyBodyEffectMask,
  createGPUBodyOutlineFilter,
  createGPUBodyGlowFilter,
  createGPUBodyParticlesFilter,
  getActiveMediaSpriteKeys,
  getMediaSpriteRecord,
  clearAllMediaSprites,
} from "@clypra/engine";
import { renderTextLayerBridged, beginTextFrame, endTextFrame } from "./textBridge.js";
import { renderStickerLayerBridged, beginStickerFrame, endStickerFrame } from "./stickerBridge.js";
import { getResourceCache } from "../resources/ResourceCache.js";
import type { EvaluatedScene, EvaluatedVisualLayer, EvaluatedMediaLayer, EvaluatedTextLayer } from "../evaluation/types.js";
import { Filter } from "pixi.js";
import { getOrUpdateFilters, releaseFilterCache, clearFilterCache } from "./filterCache.js";

export class PixiSceneCompositor {
  private renderer: any;
  private currentFrameId = 0;

  constructor(canvas: HTMLCanvasElement, width: number, height: number) {
    this.renderer = getSharedPixiRenderer(canvas, width, height);
  }

  async composeFrame(
    scene: EvaluatedScene,
    viewport: { scale: number; offsetX: number; offsetY: number; pixelRatio: number; projectWidth?: number; projectHeight?: number },
    videoElements: Map<string, HTMLVideoElement>,
    resourceHandleMap?: Map<string, any>,
    bodyMasks: Map<string, any> = new Map(),
  ): Promise<void> {
    if (!this.renderer.isReady) {
      return;
    }

    // Auto-resize renderer when project dimensions or scale change
    const projectW = viewport.projectWidth || 1920;
    const projectH = viewport.projectHeight || 1080;
    const backingW = Math.round(projectW * viewport.scale);
    const backingH = Math.round(projectH * viewport.scale);
    const app = this.renderer.getApp();
    if (app && (app.screen.width !== backingW || app.screen.height !== backingH)) {
      console.log(`[PixiSceneCompositor] Resizing renderer: ${app.screen.width}x${app.screen.height} -> ${backingW}x${backingH}`);
      this.renderer.resize(backingW, backingH);
    }

    this.currentFrameId++;
    const frameId = this.currentFrameId;

    const baseMediaContainer = this.renderer.getOverlayContainer() || this.renderer.getApp()?.stage;
    if (!baseMediaContainer) return;

    // Scale the container to project viewport scale
    baseMediaContainer.scale.set(viewport.scale);
    baseMediaContainer.position.set(0, 0);
    baseMediaContainer.sortableChildren = true;

    // Hide the legacy video sprite to prevent covering the composited layers
    const videoSprite = this.renderer.getVideoSprite();
    if (videoSprite) {
      videoSprite.visible = false;
    }

    // 1. Prepare frame
    beginTextFrame(baseMediaContainer);
    beginStickerFrame(baseMediaContainer);

    const sortedLayers = [...scene.visualLayers];

    for (let index = 0; index < sortedLayers.length; index++) {
      const layer = sortedLayers[index];
      const renderOrder = index;

      if (layer.layerType === "media") {
        const mediaLayer = layer as EvaluatedMediaLayer;
        
        if (mediaLayer.clipKind === "sticker") {
          await renderStickerLayerBridged(
            mediaLayer,
            frameId,
            baseMediaContainer,
            viewport,
            renderOrder
          );
        } else {
          let sourceElement: any = null;
          if (mediaLayer.mediaType === "video") {
            const key = `${mediaLayer.clipId}-${mediaLayer.mediaId}`;
            sourceElement = videoElements.get(key);
          } else {
            const resolvedHandle = resourceHandleMap?.get(mediaLayer.layerId) ?? mediaLayer.resourceHandle;
            if (resolvedHandle) {
              const resource = getResourceCache().get(resolvedHandle);
              if (resource && resource.data instanceof ImageBitmap) {
                sourceElement = resource.data;
              }
            }
          }

          if (sourceElement) {
            const record = getOrCreateMediaSprite(mediaLayer.clipId, mediaLayer.mediaType, sourceElement, baseMediaContainer);
            record.lastSeenFrame = frameId;
            record.sprite.visible = true;

            // Capture video source dimensions if not already stored
            if (mediaLayer.mediaType === "video" && sourceElement instanceof HTMLVideoElement) {
              const conform = mediaLayer.conform;
              if (conform && (!conform.sourceWidth || !conform.sourceHeight) && sourceElement.videoWidth && sourceElement.videoHeight) {
                const w = sourceElement.videoWidth;
                const h = sourceElement.videoHeight;
                import("../../store/timelineStore").then(({ useTimelineStore }) => {
                  const timelineStore = useTimelineStore.getState();
                  const existingClip = timelineStore.clips.find(c => c.id === mediaLayer.clipId);
                  if (existingClip) {
                    const currentConform = existingClip.conform;
                    if (!currentConform || !currentConform.sourceWidth || !currentConform.sourceHeight) {
                      timelineStore.updateClip(mediaLayer.clipId, {
                        conform: {
                          mode: currentConform?.mode || 'fit',
                          sourceWidth: w,
                          sourceHeight: h,
                          userScale: currentConform?.userScale ?? 1,
                          userOffsetX: currentConform?.userOffsetX ?? 0,
                          userOffsetY: currentConform?.userOffsetY ?? 0,
                        }
                      });
                    }
                  }
                }).catch(err => {
                  console.error("[PixiSceneCompositor] Failed to update clip conform:", err);
                });
              }
            }

            applyMediaTransform(record.sprite, mediaLayer, viewport);

            console.log(`[PixiSceneCompositor] Media dimensions:`, {
              clipId: mediaLayer.clipId,
              layerW: mediaLayer.width,
              layerH: mediaLayer.height,
              viewportScale: viewport.scale,
              containerScaleX: baseMediaContainer.scale.x,
              spriteW: record.sprite.width,
              spriteH: record.sprite.height,
              spriteScaleX: record.sprite.scale.x,
              texSourceW: record.sprite.texture.source.width,
              texW: record.sprite.texture.width,
              appW: app?.screen.width,
            });

            const width = record.sprite.texture.source.width || mediaLayer.width;
            const height = record.sprite.texture.source.height || mediaLayer.height;
            const filters = getOrUpdateFilters(mediaLayer, width, height, bodyMasks);
            record.sprite.filters = filters.length > 0 ? filters : null;
            record.sprite.zIndex = renderOrder;
          }
        }
      } else if (layer.layerType === "text") {
        const textLayer = layer as EvaluatedTextLayer;
        await renderTextLayerBridged(
          textLayer,
          frameId,
          baseMediaContainer,
          viewport,
          renderOrder
        );
      }
    }

    // 2. Reconcile frames
    endTextFrame(frameId, baseMediaContainer);
    endStickerFrame(frameId, baseMediaContainer);
    
    const activeMediaKeys = getActiveMediaSpriteKeys();
    for (const clipId of activeMediaKeys) {
      const record = getMediaSpriteRecord(clipId);
      if (record) {
        if (record.lastSeenFrame !== frameId) {
          record.sprite.visible = false;
        }
        if (frameId - record.lastSeenFrame > 180) {
          releaseMediaSprite(clipId, baseMediaContainer);
          releaseFilterCache(clipId);
        }
      }
    }

    // 3. Render stage
    this.renderer.render();
  }

  destroy(): void {
    clearFilterCache();
    if (this.renderer) {
      const baseMediaContainer = this.renderer.getOverlayContainer() || this.renderer.getApp()?.stage;
      if (baseMediaContainer) {
        clearAllMediaSprites(baseMediaContainer);
      }
      this.renderer.destroy();
    }
  }
}
