# MVP Architecture: The Pragmatic Path

## Honest Assessment

The previous architecture documents describe a 6-12 month roadmap for a team of 8-12 engineers. That's the **final destination**, not the starting point.

This document describes what to build **right now** as a solo developer shipping an open-source MVP.

---

## The Right Architecture for Tauri v2 + Rust

### Source Preview: HTML5 Video (PERMANENT)

```typescript
// This is NOT a compromise — this is CORRECT
function SourcePreview({ assetPath }: { assetPath: string }) {
  return (
    <video
      src={convertFileSrc(assetPath)}
      controls
    />
  );
}
```

**Why this is correct**:

- Hardware decoded by OS (AVFoundation on macOS, MediaFoundation on Windows)
- Zero Rust involvement during playback
- Even DaVinci Resolve uses native OS decoders for source preview

**For scrubbing when paused**: Use existing `decode_frame` Rust command (already correct).

---

### Program Preview: The Real Decision

**Current State**: Multiple `<video>` elements → ❌ Wrong (sync drift)

**MVP Solution**: Single canvas + hidden videos → ✅ Correct for now

**Future**: WebGPU compositor → ✅ Correct for v1.0, not now

#### The Canvas + Hidden Videos Pattern

```typescript
// ProgramPreview.tsx — the right MVP approach
function ProgramPreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const rafRef = useRef<number>();

  // One hidden <video> per unique source file
  // They NEVER render to screen — they're just decoders
  const hiddenVideos = useMemo(() => {
    return mediaAssets.map(asset => (
      <video
        key={asset.id}
        ref={el => { if (el) videoRefs.current.set(asset.id, el); }}
        src={convertFileSrc(asset.path)}
        style={{ display: 'none' }}
        preload="auto"
      />
    ));
  }, [mediaAssets]);

  // The render loop — driven by AudioContext clock, not rAF timestamps
  const audioCtxRef = useRef<AudioContext>();
  const playStartAudioTimeRef = useRef(0);
  const playStartTimelineTimeRef = useRef(0);

  function renderFrame() {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    // Get authoritative time from audio clock
    const elapsed = audioCtxRef.current!.currentTime - playStartAudioTimeRef.current;
    const currentTime = playStartTimelineTimeRef.current + elapsed;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Find active clips, bottom to top (z-order)
    const activeClips = getActiveClipsAtTime(currentTime);
    for (const clip of activeClips) {
      const video = videoRefs.current.get(clip.mediaId);
      if (!video) continue;

      // Sync the hidden video to current clip-local time
      const clipLocalTime = currentTime - clip.startTime + clip.trimIn;
      if (Math.abs(video.currentTime - clipLocalTime) > 0.05) {
        video.currentTime = clipLocalTime;
      }

      // Composite onto canvas
      ctx.save();
      ctx.globalAlpha = clip.opacity;
      ctx.drawImage(video, clip.x, clip.y, clip.width, clip.height);
      ctx.restore();
    }

    // Schedule audio clips via AudioBufferSourceNode
    // (same two-clock pattern OpenCut uses)

    rafRef.current = requestAnimationFrame(renderFrame);
  }

  return (
    <>
      {hiddenVideos}
      <canvas ref={canvasRef} width={canvasWidth} height={canvasHeight} />
    </>
  );
}
```

**What this gives you**:

- ✅ No sync drift (AudioContext is master clock)
- ✅ Single composited output (canvas)
- ✅ Transitions possible (canvas compositing ops)
- ✅ Text overlays possible (canvas fillText)
- ✅ No WebGPU needed yet
- ✅ Ships in weeks, not months

---

## Responsibility Matrix

### Rust Owns

- ✅ Filmstrip thumbnails
- ✅ Poster frame extraction
- ✅ Export rendering (entire pipeline)
- ✅ Audio waveform data
- ✅ Project file I/O
- ✅ Video metadata
- ✅ Hardware-accelerated decode (for thumbnails + export)

### Browser Owns

- ✅ Source preview playback
- ✅ Program preview playback
- ✅ Canvas compositing (MVP)
- ✅ Timeline UI
- ✅ All user interactions

---

## Export: Rust's Real Job

```rust
// The export pipeline — fully in Rust, no browser involvement
#[tauri::command]
async fn export_project(
    timeline: TimelineData,
    output_path: String,
    on_progress: Channel<ExportProgress>,
) -> Result<(), String> {
    // 1. Build FFmpeg filter_complex from timeline EDL
    // 2. Concatenate clips with trim points
    // 3. Mix audio tracks
    // 4. Burn text overlays via drawtext filter
    // 5. Write output file
    // Progress emitted per-frame via channel
}
```

This is where `ffmpeg-next` as a library earns its keep — not for real-time playback, but for **export** where you need frame-accurate compositing.

---

## The Actual Roadmap (Honest)

### NOW → 0.1.0 (4-6 weeks)

**Goal**: Ship a working MVP that users can actually use

- [x] Source preview: HTML5 video (already done)
- [ ] Program preview: hidden videos + canvas drawImage
- [ ] AudioContext as master clock (fixes sync drift)
- [ ] Export: FFmpeg concat via sidecar (basic, works)
- [ ] Undo/redo: Zustand history middleware
- [ ] **Ship. Get users. Get feedback.**

**Timeline**: 4-6 weeks **Outcome**: Users can edit videos and export them

---

### 0.1.0 → 0.2.0 (6-8 weeks)

**Goal**: Polish the core experience

- [ ] Export via ffmpeg-next library (proper compositor)
- [ ] Audio mixing in export
- [ ] Text overlay on canvas + in export
- [ ] Basic transitions (crossfade via canvas globalAlpha)
- [ ] Mobile (iOS/Android via Mediabunny)

**Timeline**: 6-8 weeks **Outcome**: Feature parity with basic editors

---

### 0.2.0 → 0.3.0 (8-12 weeks)

**Goal**: Advanced features

- [ ] WebGPU compositor (replaces canvas drawImage)
- [ ] GPU effects pipeline
- [ ] Color grading
- [ ] Keyframe animation

**Timeline**: 8-12 weeks **Outcome**: Professional-grade features

---

### 1.0.0 (Future)

**Goal**: Maximum performance

- [ ] Rust wgpu (if WebGPU proves insufficient)

**Timeline**: TBD **Outcome**: Native-level performance

---

## The One Critical Truth

> **None use DOM video stacking for timeline rendering.**

This is true and it matters. Multiple `<video>` elements positioned with CSS fighting the browser compositor is wrong.

**The fix**: Single canvas + hidden videos as decoders.

**Not a compromise**: This is what OpenCut does, what most web-based editors do, and it's perfectly capable for everything up to complex GPU effects.

**The mistake**: Jumping straight to WebGPU to solve that problem.

**The right answer**: Canvas first, WebGPU when canvas proves insufficient.

For a free open-source tool targeting people who want to spend less time editing, canvas + hidden videos will handle everything your users need for the next **12-18 months**.

---

## Immediate Fixes (Today)

### 1. AudioContext Master Clock

**Problem**: Multiple videos with independent clocks → sync drift

**Solution**: AudioContext as single source of truth

```typescript
// src/lib/playback/AudioClock.ts
export class AudioClock {
  private audioContext: AudioContext;
  private playStartAudioTime: number = 0;
  private playStartTimelineTime: number = 0;
  private isPlaying: boolean = false;

  constructor() {
    this.audioContext = new AudioContext();
  }

  play(currentTimelineTime: number) {
    this.playStartAudioTime = this.audioContext.currentTime;
    this.playStartTimelineTime = currentTimelineTime;
    this.isPlaying = true;
  }

  pause(): number {
    const currentTime = this.getCurrentTime();
    this.isPlaying = false;
    return currentTime;
  }

  getCurrentTime(): number {
    if (!this.isPlaying) {
      return this.playStartTimelineTime;
    }
    const elapsed = this.audioContext.currentTime - this.playStartAudioTime;
    return this.playStartTimelineTime + elapsed;
  }

  seek(time: number) {
    this.playStartTimelineTime = time;
    if (this.isPlaying) {
      this.playStartAudioTime = this.audioContext.currentTime;
    }
  }
}
```

### 2. Canvas Compositor (Replace DOM Videos)

**Current**:

```typescript
// WRONG - Multiple videos in DOM
{clips.map(clip => (
  <video
    key={clip.id}
    src={convertFileSrc(clip.source)}
    style={{ position: 'absolute', ... }}
  />
))}
```

**MVP Fix**:

```typescript
// CORRECT - Hidden videos + canvas
function ProgramPreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const clockRef = useRef(new AudioClock());

  // Hidden videos (decoders only)
  const hiddenVideos = uniqueMediaAssets.map(asset => (
    <video
      key={asset.id}
      ref={el => { if (el) videoRefs.current.set(asset.id, el); }}
      src={convertFileSrc(asset.path)}
      style={{ display: 'none' }}
    />
  ));

  // Render loop
  useEffect(() => {
    if (!isPlaying) return;

    let rafId: number;
    const render = () => {
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;

      const currentTime = clockRef.current.getCurrentTime();
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

      // Get active clips at current time
      const activeClips = getActiveClipsAtTime(currentTime);

      for (const clip of activeClips) {
        const video = videoRefs.current.get(clip.mediaId);
        if (!video) continue;

        // Sync video to clip-local time
        const clipLocalTime = currentTime - clip.startTime + clip.trimIn;
        if (Math.abs(video.currentTime - clipLocalTime) > 0.05) {
          video.currentTime = clipLocalTime;
        }

        // Draw to canvas
        ctx.save();
        ctx.globalAlpha = clip.opacity ?? 1;
        ctx.drawImage(
          video,
          clip.x, clip.y,
          clip.width, clip.height
        );
        ctx.restore();
      }

      rafId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying]);

  return (
    <>
      {hiddenVideos}
      <canvas
        ref={canvasRef}
        width={1920}
        height={1080}
        style={{ width: '100%', height: '100%' }}
      />
    </>
  );
}
```

### 3. Export Pipeline (Rust)

**Use ffmpeg-next for export, not playback**:

```rust
// src-tauri/src/export/mod.rs
use ffmpeg_next as ffmpeg;

#[tauri::command]
pub async fn export_timeline(
    timeline: TimelineData,
    output_path: String,
    progress_channel: Channel<ExportProgress>,
) -> Result<(), String> {
    // Initialize FFmpeg
    ffmpeg::init().map_err(|e| e.to_string())?;

    // Build filter graph from timeline
    let filter_graph = build_filter_graph(&timeline)?;

    // Process frames
    let mut frame_count = 0;
    let total_frames = calculate_total_frames(&timeline);

    for frame in filter_graph.frames() {
        // Encode frame
        encode_frame(&frame)?;

        frame_count += 1;
        progress_channel.send(ExportProgress {
            current: frame_count,
            total: total_frames,
            percentage: (frame_count as f64 / total_frames as f64) * 100.0,
        }).await;
    }

    Ok(())
}

fn build_filter_graph(timeline: &TimelineData) -> Result<FilterGraph, String> {
    // Build FFmpeg filter_complex from timeline:
    // - concat for clips
    // - trim for in/out points
    // - overlay for layers
    // - drawtext for text
    // - fade for transitions
    todo!("Implement filter graph builder")
}
```

---

## Key Principles

### 1. Use the Right Tool for Each Job

- **HTML5 video**: Perfect for single clip playback (Source Preview)
- **Canvas + hidden videos**: Perfect for MVP timeline (Program Preview)
- **WebGPU**: When you need GPU effects (v0.3.0+)
- **Rust wgpu**: When WebGPU proves insufficient (v1.0+)

### 2. Ship Early, Iterate Fast

- Don't build the "perfect" architecture before shipping
- Get users, get feedback, then optimize
- Canvas is good enough for 12-18 months

### 3. Rust for Heavy Lifting

- Export rendering (frame-accurate compositing)
- Thumbnail generation
- Metadata extraction
- File I/O

### 4. Browser for UI and Playback

- Timeline UI
- Preview playback
- User interactions
- Canvas compositing (MVP)

---

## Success Metrics

### 0.1.0 Success

- [ ] Users can import videos
- [ ] Users can trim and arrange clips
- [ ] Users can export final video
- [ ] No sync drift between clips
- [ ] Playback feels smooth

### 0.2.0 Success

- [ ] Text overlays work
- [ ] Basic transitions work
- [ ] Audio mixing works
- [ ] Export quality is good

### 0.3.0 Success

- [ ] GPU effects work
- [ ] Color grading works
- [ ] Performance is excellent

---

## What NOT to Do

### ❌ Don't Build WebGPU Compositor Now

- 6-8 weeks of work
- Zero users will notice
- Canvas is good enough

### ❌ Don't Build Decoder Thread Pool

- You already have ffmpeg-next with decoder pool
- Use it for export, not playback
- HTML5 video handles playback

### ❌ Don't Build "Realtime Media OS"

- That's the final destination
- Not the starting point
- Ship the MVP first

---

## Conclusion

The previous architecture documents describe where you'll be in 12 months. This document describes what to build **this month**.

**Next Actions**:

1. Implement AudioContext master clock (1 day)
2. Replace DOM videos with canvas compositor (2-3 days)
3. Test sync and playback (1 day)
4. Ship 0.1.0 (4-6 weeks total)

Canvas + hidden videos is not a compromise. It's the right architecture for an MVP. WebGPU comes later when you need it.

**Remember**: OpenCut, Clipchamp, and many other web editors use this exact pattern. It works.
