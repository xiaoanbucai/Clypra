# Architecture Reality Check

## What Happened

I wrote two comprehensive architecture documents (`ARCHITECTURE_SEPARATION.md` and `IMPLEMENTATION_ROADMAP.md`) that describe a 6-12 month roadmap for a team of 8-12 engineers.

**That was wrong.**

Those documents describe the **final destination**, not the starting point. They're useful as a north star, but dangerous if they make you think you need to build the whole system before shipping.

---

## The Truth

You're a solo developer building an open-source MVP. You need to ship in **4-6 weeks**, not 6-12 months.

---

## What's Actually Wrong Right Now

### 1. ❌ Multiple DOM Videos → Sync Drift

**Current**:

```typescript
{clips.map(clip => (
  <video src={clip.source} style={{ position: 'absolute' }} />
))}
```

**Problem**: Each video has its own clock → drift over time

**Fix**: Single canvas + hidden videos + AudioContext master clock

### 2. ❌ No Master Clock

**Problem**: Videos play independently

**Fix**: AudioContext as authoritative timing source

### 3. ⚠️ Thumbnails May Not Be Generating

**Problem**: Possible Channel or Rust command issue

**Fix**: Add logging, verify Channel.onmessage pattern

---

## The Right Architecture (MVP)

### Source Preview

```typescript
// PERMANENT - This is CORRECT
<video src={convertFileSrc(assetPath)} controls />
```

Hardware decoded by OS. Zero Rust involvement. Even DaVinci Resolve does this.

### Program Preview

```typescript
// MVP - Canvas + Hidden Videos
<>
  {/* Hidden videos (decoders only) */}
  {assets.map(asset => (
    <video
      key={asset.id}
      src={convertFileSrc(asset.path)}
      style={{ display: 'none' }}
    />
  ))}

  {/* Single composited output */}
  <canvas ref={canvasRef} width={1920} height={1080} />
</>
```

**Render loop**:

```typescript
function render() {
  const currentTime = audioClock.getCurrentTime();
  ctx.clearRect(0, 0, width, height);

  for (const clip of getActiveClips(currentTime)) {
    const video = videoRefs.get(clip.mediaId);
    video.currentTime = currentTime - clip.startTime + clip.trimIn;
    ctx.drawImage(video, clip.x, clip.y, clip.width, clip.height);
  }

  requestAnimationFrame(render);
}
```

### Export

```rust
// Rust owns export entirely
#[tauri::command]
async fn export_project(timeline: TimelineData) -> Result<()> {
    // Use ffmpeg-next to build filter_complex
    // Concat clips, mix audio, burn text
    // Write output file
}
```

---

## What NOT to Build Now

### ❌ WebGPU Compositor

- 6-8 weeks of work
- Zero users will notice
- Canvas is good enough for 12-18 months

### ❌ Decoder Thread Pool

- You already have ffmpeg-next
- Use it for export, not playback
- HTML5 video handles playback

### ❌ "Realtime Media OS"

- That's the 12-month vision
- Not the 6-week MVP
- Ship first, optimize later

---

## The Actual Roadmap

### NOW → 0.1.0 (4-6 weeks)

- [x] Source preview: HTML5 video
- [ ] Program preview: canvas + hidden videos
- [ ] AudioContext master clock
- [ ] Basic export via FFmpeg
- [ ] **SHIP**

### 0.1.0 → 0.2.0 (6-8 weeks)

- [ ] Text overlays
- [ ] Basic transitions
- [ ] Audio mixing
- [ ] Better export

### 0.2.0 → 0.3.0 (8-12 weeks)

- [ ] WebGPU compositor
- [ ] GPU effects
- [ ] Color grading

### 1.0.0 (Future)

- [ ] Rust wgpu (if needed)

---

## Files Created

### ✅ Keep These

- `MVP_ARCHITECTURE.md` - The pragmatic path
- `IMMEDIATE_FIXES.md` - What to do today
- `src/lib/playback/AudioClock.ts` - Master clock implementation

### 📚 Reference Only

- `ARCHITECTURE_SEPARATION.md` - 12-month vision
- `IMPLEMENTATION_ROADMAP.md` - Full team roadmap

These are useful as a north star, but don't let them block shipping.

---

## Key Insight

> **Canvas + hidden videos is NOT a compromise.**

This is what OpenCut, Clipchamp, and many other web editors use. It's the **correct** architecture for an MVP.

WebGPU comes later when you need GPU effects. You don't need GPU effects to ship a useful video editor.

---

## What to Do Right Now

### Today (2-3 hours)

1. Implement AudioClock in PreviewPanel
2. Replace DOM videos with canvas compositor
3. Test sync with multiple clips

### Tomorrow (2-3 hours)

1. Debug thumbnail generation if needed
2. Polish canvas rendering
3. Test with various video formats

### This Week

1. Verify no sync drift
2. Ensure smooth playback
3. Start export pipeline

### Next 4-6 Weeks

1. Finish export
2. Add undo/redo
3. Polish UI
4. **Ship 0.1.0**

---

## Success Metrics

### 0.1.0 is successful when:

- [ ] Users can import videos
- [ ] Users can trim and arrange clips
- [ ] Users can export final video
- [ ] No sync drift between clips
- [ ] Playback feels smooth

That's it. Everything else is v0.2.0+.

---

## Remember

- Ship early, iterate fast
- Get users, get feedback
- Canvas is good enough
- Don't build the "perfect" architecture before shipping
- The best architecture is the one that ships

---

## Next Action

Open `src/components/editor/PreviewPanel.tsx` and start implementing the canvas compositor with AudioClock.

See `IMMEDIATE_FIXES.md` for detailed implementation steps.
