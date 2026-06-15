/**
 * Overlay Cache Manager
 * Handles downloading and caching animated overlay video files
 */

import { BaseDirectory, exists, mkdir, writeFile, readFile, remove, readDir } from "@tauri-apps/plugin-fs";
import { join, appCacheDir } from "@tauri-apps/api/path";
import type { OverlayAsset } from "@/features/video-effects/types";

export interface CachedOverlay {
  id: string;
  localPath: string;
  originalUrl: string;
  fileName: string;
  size: number;
  downloadedAt: number;
  metadata: {
    duration: number;
    format: string;
    width?: number;
    height?: number;
    defaultOpacity: number;
    blendMode: string;
  };
}

export interface OverlayDownloadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

const CACHE_DIR = "overlays";
const CACHE_INDEX_FILE = "index.json";

/**
 * Sanitize filename to be filesystem-safe
 */
function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9-_. ]/g, "_")
    .replace(/\s+/g, "_")
    .substring(0, 100);
}

/**
 * Get file extension from URL or default to webm
 */
function getFileExtension(url: string): string {
  const match = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  return match ? match[1] : "webm";
}

/**
 * OverlayCacheManager - Singleton for managing overlay video cache
 */
class OverlayCacheManager {
  private cacheIndex: Map<string, CachedOverlay> = new Map();
  private cacheDir: string | null = null;
  private initialized = false;

  /**
   * Initialize the cache directory and load index
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Get cache directory path
      const appCache = await appCacheDir();
      this.cacheDir = await join(appCache, CACHE_DIR);

      // Create cache directory if it doesn't exist
      const dirExists = await exists(this.cacheDir, { baseDir: BaseDirectory.AppCache });
      if (!dirExists) {
        await mkdir(this.cacheDir, { baseDir: BaseDirectory.AppCache, recursive: true });
      }

      // Load cache index from disk
      await this.loadIndex();
      this.initialized = true;
    } catch (error) {
      console.error("[OverlayCache] Failed to initialize:", error);
      throw new Error("Failed to initialize overlay cache");
    }
  }

  /**
   * Load cache index from disk and verify files still exist
   */
  private async loadIndex(): Promise<void> {
    if (!this.cacheDir) return;

    try {
      const indexPath = await join(this.cacheDir, CACHE_INDEX_FILE);
      const indexExists = await exists(indexPath, { baseDir: BaseDirectory.AppCache });

      if (indexExists) {
        const indexData = await readFile(indexPath, { baseDir: BaseDirectory.AppCache });
        const indexJson = new TextDecoder().decode(indexData);
        const indexArray: CachedOverlay[] = JSON.parse(indexJson);

        this.cacheIndex.clear();

        // Verify each cached file still exists on disk before trusting the index
        const appCache = await appCacheDir();
        for (const entry of indexArray) {
          try {
            const filePath = await join(appCache, entry.localPath);
            const fileExists = await exists(filePath, { baseDir: BaseDirectory.AppCache });
            if (fileExists) {
              this.cacheIndex.set(entry.id, entry);
            } else {
              console.warn(`[OverlayCache] Index entry exists but file missing: ${entry.id}`);
            }
          } catch (err) {
            console.warn(`[OverlayCache] Failed to verify file for ${entry.id}:`, err);
          }
        }

        console.log(`[OverlayCache] Loaded ${this.cacheIndex.size} cached overlays from disk`);
      }
    } catch (error) {
      console.warn("[OverlayCache] Failed to load index, starting fresh:", error);
      this.cacheIndex.clear();
    }
  }

  /**
   * Save cache index to disk
   */
  private async saveIndex(): Promise<void> {
    if (!this.cacheDir) return;

    try {
      const indexPath = await join(this.cacheDir, CACHE_INDEX_FILE);
      const indexArray = Array.from(this.cacheIndex.values());
      const indexJson = JSON.stringify(indexArray, null, 2);
      const indexData = new TextEncoder().encode(indexJson);

      await writeFile(indexPath, indexData, { baseDir: BaseDirectory.AppCache });
    } catch (error) {
      console.error("[OverlayCache] Failed to save index:", error);
    }
  }

  /**
   * Check if overlay is already cached
   */
  isCached(overlayId: string): boolean {
    return this.cacheIndex.has(overlayId);
  }

  /**
   * Get cached overlay info
   */
  getCached(overlayId: string): CachedOverlay | null {
    return this.cacheIndex.get(overlayId) || null;
  }

  /**
   * Get cached overlay path
   */
  getCachedPath(overlayId: string): string | null {
    const cached = this.cacheIndex.get(overlayId);
    return cached ? cached.localPath : null;
  }

  /**
   * Download overlay video to cache
   */
  async downloadOverlay(overlay: OverlayAsset, onProgress?: (progress: OverlayDownloadProgress) => void): Promise<CachedOverlay> {
    await this.initialize();

    if (!this.cacheDir) {
      throw new Error("Cache directory not initialized");
    }

    // Check if already cached
    if (this.isCached(overlay.id)) {
      const cached = this.cacheIndex.get(overlay.id)!;
      return cached;
    }

    try {
      // Generate filename
      const ext = getFileExtension(overlay.url);
      const sanitizedName = sanitizeFileName(overlay.name);
      const fileName = `${overlay.id}_${sanitizedName}.${ext}`;

      // Use relative path for storage (just CACHE_DIR/filename)
      const relativePath = `${CACHE_DIR}/${fileName}`;

      // Download file with progress tracking
      const response = await fetch(overlay.url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentLength = response.headers.get("content-length");
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      let loaded = 0;

      // Read response as stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Failed to get response reader");
      }

      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        chunks.push(value);
        loaded += value.length;

        if (onProgress && total > 0) {
          onProgress({
            loaded,
            total,
            percentage: Math.round((loaded / total) * 100),
          });
        }
      }

      // Combine chunks
      const fileData = new Uint8Array(loaded);
      let offset = 0;
      for (const chunk of chunks) {
        fileData.set(chunk, offset);
        offset += chunk.length;
      }

      // Write to disk using relative path from AppCache base
      await writeFile(relativePath, fileData, { baseDir: BaseDirectory.AppCache });

      // Create cache entry with relative path
      const cachedOverlay: CachedOverlay = {
        id: overlay.id,
        localPath: relativePath, // Store relative path, not absolute
        originalUrl: overlay.url,
        fileName,
        size: loaded,
        downloadedAt: Date.now(),
        metadata: {
          duration: overlay.duration,
          format: ext,
          width: overlay.width,
          height: overlay.height,
          defaultOpacity: overlay.recommended?.opacity || 1.0,
          blendMode: overlay.recommended?.blendMode || overlay.blendMode || "normal",
        },
      };

      // Update index
      this.cacheIndex.set(overlay.id, cachedOverlay);
      await this.saveIndex();

      return cachedOverlay;
    } catch (error) {
      console.error("[OverlayCache] Download failed:", error);
      throw new Error(`Failed to download overlay: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Ensure overlay is downloaded (convenience method)
   */
  async ensureDownloaded(overlay: OverlayAsset, onProgress?: (progress: OverlayDownloadProgress) => void): Promise<CachedOverlay> {
    await this.initialize();

    if (this.isCached(overlay.id)) {
      return this.cacheIndex.get(overlay.id)!;
    }

    return this.downloadOverlay(overlay, onProgress);
  }

  /**
   * Clear specific cached overlay
   */
  async clearCache(overlayId: string): Promise<void> {
    await this.initialize();

    const cached = this.cacheIndex.get(overlayId);
    if (!cached) return;

    try {
      // Delete file
      const fileExists = await exists(cached.localPath, { baseDir: BaseDirectory.AppCache });
      if (fileExists) {
        await remove(cached.localPath, { baseDir: BaseDirectory.AppCache });
      }

      // Remove from index
      this.cacheIndex.delete(overlayId);
      await this.saveIndex();
    } catch (error) {
      console.error("[OverlayCache] Failed to clear cache:", error);
      throw error;
    }
  }

  /**
   * Clear all cached overlay files
   */
  async clearAllCache(): Promise<void> {
    await this.initialize();

    if (!this.cacheDir) return;

    try {
      // Read all files in cache directory
      const entries = await readDir(this.cacheDir, { baseDir: BaseDirectory.AppCache });

      // Delete all files except index
      for (const entry of entries) {
        if (entry.name !== CACHE_INDEX_FILE) {
          const filePath = await join(this.cacheDir, entry.name);
          await remove(filePath, { baseDir: BaseDirectory.AppCache });
        }
      }

      // Clear index
      this.cacheIndex.clear();
      await this.saveIndex();
    } catch (error) {
      console.error("[OverlayCache] Failed to clear all cache:", error);
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { count: number; totalSize: number; items: CachedOverlay[] } {
    const items = Array.from(this.cacheIndex.values());
    const totalSize = items.reduce((sum, item) => sum + item.size, 0);

    return {
      count: items.length,
      totalSize,
      items,
    };
  }

  /**
   * Get all cached overlays
   */
  getAllCached(): CachedOverlay[] {
    return Array.from(this.cacheIndex.values());
  }
}

// Singleton instance
export const overlayCacheManager = new OverlayCacheManager();
