# START HERE

## What Just Happened

You asked me to document the architecture separation between Source Preview and Program Preview. I wrote two comprehensive documents describing a professional-grade video editor architecture.

**Then you gave me a reality check.**

Those documents describe a 6-12 month roadmap for a large team. You're a solo developer who needs to ship an MVP in 4-6 weeks.

---

## Read These Documents in Order

### 1. 📖 **ARCHITECTURE_REALITY_CHECK.md** (Read First)

The honest assessment of what went wrong and what's actually needed.

### 2. 🎯 **MVP_ARCHITECTURE.md** (Read Second)

The pragmatic architecture for shipping in 4-6 weeks.

### 3. 🔧 **IMMEDIATE_FIXES.md** (Read Third)

What to implement today (2-3 hours of work).

### 4. 📚 **ARCHITECTURE_SEPARATION.md** (Reference)

The 12-month vision. Useful as a north star, but don't let it block shipping.

### 5. 📚 **IMPLEMENTATION_ROADMAP.md** (Reference)

The full team roadmap. Good for understanding the final destination.

---

## TL;DR - What to Do Right Now

### The Problem

- Multiple DOM videos → sync drift
- No master clock → videos play independently
- Trying to build "perfect" architecture → not shipping

### The Solution

- Single canvas + hidden videos
- AudioContext as master clock
- Ship MVP in 4-6 weeks

### The Implementation

**Created**:

- ✅ `src/lib/playback/AudioClock.ts` - Master clock (done)

**Next**:

- 🔧 Update `PreviewPanel.tsx` to use canvas compositor
- 🔧 Test sync with multiple clips
- 🔧 Debug thumbnails if needed

---

## The Right Architecture (One Diagram)

```
┌─────────────────────────────────────────────────┐
│                  CLYPRA MVP                     │
├─────────────────────────────────────────────────┤
│                                                 │
│  SOURCE PREVIEW (Single Clip)                   │
│  ┌───────────────────────────────────────────┐  │
│  │  <video src={asset} controls />           │  │
│  │  Hardware decoded by OS                   │  │
│  │  Zero Rust involvement                    │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  PROGRAM PREVIEW (Timeline)                     │
│  ┌───────────────────────────────────────────┐  │
│  │  Hidden Videos (decoders)                 │  │
│  │  <video style="display:none" />           │  │
│  │  <video style="display:none" />           │  │
│  │                                           │  │
│  │  AudioContext (master clock)              │  │
│  │  ↓                                        │  │
│  │  Canvas Compositor                        │  │
│  │  ctx.drawImage(video, x, y, w, h)        │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  EXPORT (Rust)                                  │
│  ┌───────────────────────────────────────────┐  │
│  │  ffmpeg-next                              │  │
│  │  ↓                                        │  │
│  │  Build filter_complex                     │  │
│  │  ↓                                        │  │
│  │  Concat clips, mix audio, burn text      │  │
│  │  ↓                                        │  │
│  │  Write output file                        │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## Key Insights

### 1. HTML5 Video is NOT a Compromise

It's the **correct** solution for Source Preview. Even DaVinci Resolve uses native OS decoders.

### 2. Canvas + Hidden Videos is NOT a Compromise

It's the **correct** MVP solution for Program Preview. OpenCut, Clipchamp, and many others use this.

### 3. WebGPU Comes Later

When you need GPU effects (v0.3.0+), not before you have working export.

### 4. Rust Owns Export

This is where ffmpeg-next earns its keep. Frame-accurate compositing for export, not playback.

---

## Timeline

### Today (2-3 hours)

1. Read `IMMEDIATE_FIXES.md`
2. Implement AudioClock in PreviewPanel
3. Replace DOM videos with canvas

### This Week

1. Test sync with multiple clips
2. Debug thumbnails if needed
3. Polish canvas rendering

### Next 4-6 Weeks

1. Finish export pipeline
2. Add undo/redo
3. Polish UI
4. **Ship 0.1.0**

---

## Success Criteria for 0.1.0

- [ ] Users can import videos
- [ ] Users can trim and arrange clips
- [ ] Users can export final video
- [ ] No sync drift between clips
- [ ] Playback feels smooth

**That's it.** Everything else is v0.2.0+.

---

## What NOT to Build

- ❌ WebGPU compositor (6-8 weeks, zero user value now)
- ❌ Decoder thread pool (you already have it)
- ❌ "Realtime media OS" (12-month vision, not 6-week MVP)

---

## Remember

> **The best architecture is the one that ships.**

Canvas + hidden videos will serve your users for 12-18 months. Ship it, get feedback, iterate.

---

## Next Action

Open `IMMEDIATE_FIXES.md` and start implementing the canvas compositor.

You have all the code examples you need. It's 2-3 hours of work.

**Let's ship this thing.**
