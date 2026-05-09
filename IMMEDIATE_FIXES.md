# Immediate Fixes - Action Plan

## Three Things to Fix Today

Based on the console logs and architecture review, here are the three critical fixes needed right now:

---

## 1. ✅ Channel Constructor (ALREADY FIXED)

**Status**: Already correct in `ClipFilmstrip.tsx`

```typescript
// CORRECT - Already implemented
const channel = new Channel<ThumbnailTile>();
channel.onmessage = async (tile) => {
  // Handle tile
};
```

No action needed.

---

## 2. 🔧 Program Preview Sync Drift

**Problem**: Multiple `<video>` elements with independent timing → sync drift

**Solution**: Implement AudioContext master clock + canvas compositor

### Step 2.1: Create AudioClock (DONE)

File created: `src/lib/playback/AudioClock.ts`

### Step 2.2: Update PreviewPanel to Use Canvas

**Current State**: `PreviewPanel.tsx` uses multiple DOM videos

**Required Changes**:

```typescript
// src/components/editor/PreviewPanel.tsx

import { AudioClock } from '@/lib/playback/AudioClock';

function ProgramPreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const clockRef = useRef<AudioClock>(new AudioClock());
  const rafRef = useRef<number>();

  // Get unique media assets (one video element per source file)
  const uniqueAssets = useMemo(() => {
    const assetMap = new Map();
    clips.forEach(clip => {
      const asset = mediaAssets.find(a => a.id === clip.mediaId);
      if (asset && !assetMap.has(asset.id)) {
        assetMap.set(asset.id, asset);
      }
    });
    return Array.from(assetMap.values());
  }, [clips, mediaAssets]);

  // Hidden video elements (decoders only, never visible)
  const hiddenVideos = uniqueAssets.map(asset => (
    <video
      key={asset.id}
      ref={el => {
        if (el) {
          videoRefs.current.set(asset.id, el);
          el.preload = 'auto';
        }
      }}
      src={convertFileSrc(asset.path)}
      style={{ display: 'none' }}
      muted // Muted because we'll handle audio separately
    />
  ));

  // Get active clips at given time
  const getActiveClipsAtTime = useCallback((time: number) => {
    return clips
      .filter(clip => {
        const clipStart = clip.startTime;
        const clipEnd = clip.startTime + clip.duration;
        return time >= clipStart && time < clipEnd;
      })
      .sort((a, b) => a.trackIndex - b.trackIndex); // Bottom to top
  }, [clips]);

  // Render loop
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = undefined;
      }
      return;
    }

    const render = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx || !canvas) return;

      // Get current time from master clock
      const currentTime = clockRef.current.getCurrentTime();

      // Clear canvas
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Get active clips
      const activeClips = getActiveClipsAtTime(currentTime);

      // Render each clip
      for (const clip of activeClips) {
        const video = videoRefs.current.get(clip.mediaId);
        if (!video) continue;

        // Calculate clip-local time
        const clipLocalTime = currentTime - clip.startTime + (clip.trimIn || 0);

        // Sync video to clip-local time (with tolerance to avoid constant seeking)
        if (Math.abs(video.currentTime - clipLocalTime) > 0.05) {
          video.currentTime = clipLocalTime;
        }

        // Ensure video is playing
        if (video.paused) {
          video.play().catch(err => {
            console.warn('Failed to play video:', err);
          });
        }

        // Draw video frame to canvas
        ctx.save();

        // Apply clip transforms
        ctx.globalAlpha = clip.opacity ?? 1;

        // Draw at clip position (for now, just fill canvas)
        // TODO: Respect clip.x, clip.y, clip.width, clip.height
        ctx.drawImage(
          video,
          0, 0, canvas.width, canvas.height
        );

        ctx.restore();
      }

      // Continue render loop
      rafRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isPlaying, getActiveClipsAtTime]);

  // Handle play/pause
  const handlePlay = useCallback(() => {
    const currentTime = clockRef.current.getCurrentTime();
    clockRef.current.play(currentTime);
    setIsPlaying(true);
  }, []);

  const handlePause = useCallback(() => {
    const pausedTime = clockRef.current.pause();
    setIsPlaying(false);

    // Pause all videos
    videoRefs.current.forEach(video => {
      video.pause();
    });
  }, []);

  // Handle seek
  const handleSeek = useCallback((time: number) => {
    clockRef.current.seek(time);

    // If playing, videos will sync in render loop
    // If paused, sync immediately
    if (!isPlaying) {
      const activeClips = getActiveClipsAtTime(time);
      activeClips.forEach(clip => {
        const video = videoRefs.current.get(clip.mediaId);
        if (video) {
          const clipLocalTime = time - clip.startTime + (clip.trimIn || 0);
          video.currentTime = clipLocalTime;
        }
      });
    }
  }, [isPlaying, getActiveClipsAtTime]);

  return (
    <div className="preview-container">
      {hiddenVideos}
      <canvas
        ref={canvasRef}
        width={1920}
        height={1080}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          backgroundColor: '#000',
        }}
      />
      <div className="controls">
        <button onClick={isPlaying ? handlePause : handlePlay}>
          {isPlaying ? 'Pause' : 'Play'}
        </button>
      </div>
    </div>
  );
}
```

### Step 2.3: Test Sync

**Test Cases**:

1. Add 2-3 clips to timeline
2. Play - verify no drift between clips
3. Seek - verify all clips jump together
4. Pause/resume - verify sync maintained

---

## 3. 🔧 Zero Frames Received (If Still Occurring)

**Problem**: Thumbnails not generating

**Possible Causes**:

1. Channel not receiving messages
2. Rust command failing silently
3. Path conversion issue

**Debug Steps**:

```typescript
// In ClipFilmstrip.tsx, add logging:

const channel = new Channel<ThumbnailTile>();
console.log("Channel created:", channel);

channel.onmessage = async (tile) => {
  console.log("Received tile:", tile);
  // ... rest of handler
};

// Before invoke:
console.log("Requesting thumbnails for:", {
  clipId: clip.id,
  sourcePath: asset.path,
  startTime: clip.trimIn,
  duration: clip.duration,
});

// After invoke:
try {
  await invoke("generate_filmstrip_tiles", {
    clipId: clip.id,
    sourcePath: asset.path,
    startTime: clip.trimIn || 0,
    duration: clip.duration,
    tileWidth: TILE_WIDTH,
    tileHeight: TILE_HEIGHT,
    onProgress: channel,
  });
  console.log("Thumbnail generation completed");
} catch (error) {
  console.error("Thumbnail generation failed:", error);
}
```

**Check Rust Side**:

```rust
// In src-tauri/src/commands/thumbnails.rs
// Ensure channel.send() is being called

#[tauri::command]
pub async fn generate_filmstrip_tiles(
    clip_id: String,
    source_path: String,
    start_time: f64,
    duration: f64,
    tile_width: u32,
    tile_height: u32,
    on_progress: Channel<ThumbnailTile>,
) -> Result<(), String> {
    println!("Generating thumbnails for: {}", source_path);

    // ... decode logic ...

    let tile = ThumbnailTile {
        clip_id: clip_id.clone(),
        index,
        data: rgba_data,
        width: tile_width,
        height: tile_height,
    };

    println!("Sending tile {}", index);
    on_progress.send(tile).await.map_err(|e| {
        eprintln!("Failed to send tile: {}", e);
        e.to_string()
    })?;

    Ok(())
}
```

---

## Priority Order

### Today (2-3 hours)

1. ✅ Verify Channel fix is working
2. 🔧 Implement AudioClock in PreviewPanel
3. 🔧 Replace DOM videos with canvas compositor

### Tomorrow (2-3 hours)

1. Test sync with multiple clips
2. Debug thumbnail generation if needed
3. Polish canvas rendering

### This Week

1. Verify no sync drift
2. Ensure smooth playback
3. Test with various video formats

---

## Success Criteria

### AudioClock Working

- [ ] Multiple clips play in sync
- [ ] No drift over 30+ seconds
- [ ] Seek affects all clips simultaneously
- [ ] Pause/resume maintains sync

### Canvas Compositor Working

- [ ] Single canvas shows composited output
- [ ] No visible DOM videos
- [ ] Smooth playback (no stuttering)
- [ ] Clips layer correctly (z-order)

### Thumbnails Working

- [ ] Filmstrip shows thumbnails
- [ ] Thumbnails generate progressively
- [ ] No console errors
- [ ] Performance acceptable

---

## Next Steps After Fixes

Once these three issues are resolved:

1. **Export Pipeline** (Rust)
   - Implement basic FFmpeg concat
   - Test with simple timeline
   - Add progress reporting

2. **Undo/Redo** (Zustand)
   - Add history middleware
   - Test with clip operations
   - Add keyboard shortcuts

3. **Polish & Ship 0.1.0**
   - Fix remaining bugs
   - Write documentation
   - Create demo video
   - Announce on GitHub

---

## Resources

- **AudioContext API**: https://developer.mozilla.org/en-US/docs/Web/API/AudioContext
- **Canvas API**: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API
- **Tauri Channels**: https://v2.tauri.app/develop/calling-rust/#channels
- **OpenCut Source**: https://github.com/mifi/lossless-cut (reference implementation)

---

## Notes

- Canvas + hidden videos is NOT a compromise - it's the correct MVP architecture
- WebGPU comes later (v0.3.0+) when you need GPU effects
- Focus on shipping, not perfection
- Get users, get feedback, iterate
