# Critical Architecture Separation: Source Preview vs Program Preview

## Executive Summary

**Current Problem**: GPUPreview is trying to be both a media player AND a realtime compositor, creating catastrophic performance issues.

**Root Cause**: Conflating two completely different workloads into a single system.

**Solution**: Separate into three independent systems with clear boundaries.

---

## Performance Crisis Analysis

### Current Bottleneck Metrics

```
Frame Decode Time: 80ms - 230ms
Target Frame Time (30fps): 33.3ms
Actual Playback Rate: ~8.3 FPS (1000ms / 120ms)
User Experience: "0.1x playback speed"
```

### Current Pipeline Problems

```
requestAnimationFrame
    ↓
invoke("decode_frame_gpu")
    ↓
Rust allocates RGBA array
    ↓
Serialize huge array
    ↓
IPC transfer (expensive)
    ↓
JS allocates Uint8Array
    ↓
Upload to GPU texture
    ↓
Render
    ↓
REPEAT EVERY FRAME
```

**Issues**:

- 80-230ms decode per frame
- Frequent SEEK operations
- Texture upload every frame
- JS → Rust → JS roundtrip every frame
- RGBA array transfer every frame
- requestAnimationFrame driving decoding (wrong!)

---

## The Three Systems

### 1. Source Preview (Media Playback)

**Purpose**: Single clip viewer for asset inspection

**Use Cases**:

- Previewing assets
- Trimming clips
- Scrubbing
- Frame inspection

**NOT FOR**:

- Multi-layer compositing
- Effects rendering
- Timeline playback

#### Correct Architecture

**Playback Mode** (Normal Speed):

```
HTML5 <video>
    ↓
Hardware Decoder (AVFoundation on macOS)
    ↓
Direct Compositor
    ↓
GPU Display
```

**Zero Rust involvement during playback.**

**Scrubbing Mode** (Paused/Seeking):

```
Timeline Scrub Event
    ↓
Rust Decoder
    ↓
GPU Texture Upload
    ↓
Canvas/WebGPU Render
```

**Only decode manually for**:

- Frame stepping
- Accurate scrubbing
- Thumbnails
- Freeze frames

#### Implementation Status

✅ **KEEP**: HTML5 playback (correct) ✅ **KEEP**: GPU scrubbing (correct) ❌ **REMOVE**: Manual decode during playback

---

### 2. Program Preview (Realtime Compositor)

**Purpose**: Multi-layer timeline rendering with effects

**Requirements**:

- Multiple layers
- Transforms
- Text overlays
- Transitions
- Effects
- Blending modes
- Masks
- LUTs
- Animations
- Keyframes
- Motion graphics

#### Current Problem

**Current Approach**:

```
Multiple HTML5 <video> elements
    ↓
Positioned via DOM/CSS
    ↓
Browser compositor
```

**Why This Fails**:

- ❌ Sync drift between videos
- ❌ Inaccurate seeking
- ❌ Transitions impossible
- ❌ Filters inconsistent
- ❌ Heavy DOM overhead
- ❌ Browser compositor fights you
- ❌ No frame accuracy
- ❌ Professional effects pipeline impossible

**Breaks at scale with**:

- 4K resolution
- Multiple layers (>3)
- Transitions
- Effects
- Color grading
- Text animation

#### Correct Architecture

```
Frontend (React)
    ↓
Playback Engine Controller
    ↓
Rust Render Engine
    ↓
GPU Renderer (wgpu)
    ↓
Single Surface Output
```

**React Responsibilities** (UI ONLY):

- ✅ Timeline UI
- ✅ Transport controls
- ✅ Inspector panels
- ✅ Asset browser
- ✅ Overlays
- ✅ User interactions

**React NEVER Does**:

- ❌ Decoding
- ❌ Compositing
- ❌ Effects rendering

**Rust Responsibilities**:

**Media Engine**:

- Decoding
- Caching
- Frame scheduling
- Synchronization

**Render Engine**:

- Compositing
- Transforms
- Effects
- Transitions

**GPU Engine**:

- Textures
- Shaders
- Render passes

---

### 3. Professional Pipeline Architecture

```
FFmpeg / AVFoundation
    ↓
Decoded GPU Frames
    ↓
Frame Cache
    ↓
Timeline Compositor
    ↓
Effects Pipeline
    ↓
wgpu Renderer
    ↓
Surface Texture
    ↓
Presented to Tauri Window
```

---

## Implementation Phases

### PHASE 1: Tactical Stabilization (IMMEDIATE)

**Goal**: Stop the bleeding, stabilize current system

#### Source Preview

- ✅ **KEEP**: HTML5 playback
- ✅ **KEEP**: GPU scrubbing only
- ❌ **REMOVE**: Manual decode during playback

#### Program Preview

- ⚠️ **TEMPORARILY KEEP**: HTML5 videos
- ✅ **ADD**: Centralized timing
  - One playback clock
  - No independent video timing
  - Prevent drift

**Critical Fix**: Right now every `<video>` is its own clock → causes drift

**Timeline**: 1-2 weeks

---

### PHASE 2: Real Playback Core

**Goal**: Build authoritative timing system

#### Components to Build

**Rust Side**:

```rust
struct PlaybackClock {
    current_time: f64,
    playback_rate: f64,
    is_playing: bool,
}

struct FrameScheduler {
    target_fps: f64,
    frame_queue: VecDeque<Frame>,
}

struct TimelineResolver {
    tracks: Vec<Track>,
    clips: Vec<Clip>,
}

struct ClipResolver {
    // Resolves which clips are active at given time
}
```

**This becomes the authoritative timing source** (NOT the browser).

**Timeline**: 3-4 weeks

---

### PHASE 3: GPU Compositor

**Goal**: Replace DOM video layers with single GPU canvas

#### Architecture Shift

**FROM**:

```
Multiple DOM <video> elements
CSS transforms
Browser compositor
```

**TO**:

```
Single GPU Canvas
    ↓
WebGPU Renderer
    ↓
Texture Atlases
    ↓
Render Passes
```

#### Technology Stack

- **Frontend**: WebGPU
- **Backend**: wgpu
- **Shared**: Texture atlases, render passes

**Timeline**: 6-8 weeks

---

### PHASE 4: Decode Architecture

**Goal**: Proper async decode pipeline

#### Current Problem

```rust
// WRONG - This is a scrub API, not playback
decode_frame_gpu(time)
```

#### Correct Design

```
Decoder Thread
    ↓
Continuous Decode
    ↓
Frame Queue (prefetch)
    ↓
Renderer Consumes Queue
```

**Like**: VLC, Resolve, Premiere, mpv

#### Components

```rust
struct DecoderThread {
    // Continuous decode ahead of playhead
}

struct FrameQueue {
    capacity: usize,
    frames: VecDeque<DecodedFrame>,
}

struct PrefetchWindow {
    ahead_seconds: f64,
    behind_seconds: f64,
}

struct PredictiveDecoder {
    // Predicts playhead movement
    // Decodes ahead
}
```

#### Requirements

- Hardware decoding
- Async decode workers
- Frame queues
- Prefetch windows
- Predictive decoding

**Timeline**: 4-6 weeks

---

## Current Biggest Bottleneck

### The Problem

```typescript
// EXTREMELY EXPENSIVE
const rgbaData = await invoke<number[]>("decode_frame_gpu");
```

**Why This Destroys Performance**:

1. Rust allocates RGBA array
2. Serializes huge array (1920×1080×4 = 8.3MB)
3. IPC transfer (slow)
4. JS allocates Uint8Array
5. Upload to GPU
6. **REPEAT EVERY FRAME**

### Correct High-Performance Approach

```
Rust Decode
    ↓
GPU Texture Directly
    ↓
Shared GPU Surface
    ↓
Renderer Uses Texture
```

**NOT**:

```
Rust → JS RGBA Arrays
```

---

## Ideal Tauri Architecture

### Backend (Rust)

- `ffmpeg-next` - Decoding
- `wgpu` - GPU rendering
- `tokio` - Async runtime
- `rayon` - Parallel processing

### Frontend (React)

- **No rendering responsibility**
- **Only orchestration**

### Renderer Options

#### Option A: Pure Rust (Best Performance)

```
Pure Rust Renderer
    ↓
wgpu
    ↓
Tauri Window Surface
```

**Pros**: Most performant **Cons**: Very hard to implement

#### Option B: Practical Hybrid (RECOMMENDED)

```
Rust:
- Decoding
- Frame cache
- Timing

Frontend:
- WebGPU compositor
- Shaders
- Effects
```

**Avoids**:

- DOM renderer
- HTML layering
- CSS transforms

**While staying realistic for current team capabilities.**

---

## What Professional Editors Do

### Premiere Pro

- Native renderer
- No DOM involvement

### DaVinci Resolve

- GPU-native compositor
- Metal/CUDA pipeline

### Final Cut Pro

- Metal-native pipeline
- Zero web tech in render path

### CapCut

- Massive GPU compositor pipeline
- Hardware acceleration throughout

### Common Pattern

**None use DOM video stacking for timeline rendering.**

---

## Immediate Next Steps

### Step 1: Separate Engines

```typescript
// Create separate systems
class SourcePreviewEngine {
  // Media playback only
  // HTML5 video
  // GPU scrubbing
}

class ProgramRenderEngine {
  // Timeline rendering
  // Multi-layer compositing
  // Effects pipeline
}
```

### Step 2: Build Playback Clock

```rust
// Single source of truth
pub struct PlaybackClock {
    current_time: Duration,
    playback_rate: f64,
    is_playing: bool,
}
```

### Step 3: Build Frame Infrastructure

```rust
pub struct FrameCache {
    // LRU cache of decoded frames
}

pub struct DecodeQueue {
    // Async decode queue
}

pub struct Prefetcher {
    // Predictive frame prefetching
}
```

### Step 4: Move to GPU Compositing

```
FROM: DOM compositing
TO:   GPU compositing (WebGPU)
```

---

## Biggest Architectural Insight

### A Video Editor Is NOT:

- ❌ A video player
- ❌ A React app

### A Video Editor IS:

- ✅ **A realtime media operating system**

Once you internalize this, architectural decisions become much clearer.

---

## Key Principles

### 1. Separation of Concerns

- **Source Preview** = Media playback problem
- **Program Preview** = Realtime compositor problem
- **Never mix these**

### 2. Right Tool for the Job

- **HTML5 video** = Perfect for single clip playback
- **GPU compositor** = Required for multi-layer timeline

### 3. Performance First

- Decode ahead, not on-demand
- Queue frames, don't block
- GPU textures, not CPU arrays
- Shared surfaces, not IPC transfers

### 4. Professional Standards

- Frame accuracy
- Sync precision
- Predictable performance
- Scalable architecture

---

## Success Metrics

### Phase 1 Success

- [ ] Source preview plays at native speed
- [ ] No manual decode during playback
- [ ] Centralized playback clock
- [ ] No video sync drift

### Phase 2 Success

- [ ] Rust owns timing authority
- [ ] Frame scheduler operational
- [ ] Timeline resolver working
- [ ] Predictable frame delivery

### Phase 3 Success

- [ ] Single GPU canvas rendering
- [ ] Multiple layers composited
- [ ] Transitions working
- [ ] Effects pipeline operational

### Phase 4 Success

- [ ] Async decode workers
- [ ] Frame prefetching
- [ ] Hardware acceleration
- [ ] 30fps sustained playback with 4K

---

## Conclusion

The current architecture conflates media playback with realtime rendering. This creates fundamental performance problems that cannot be solved with optimization alone.

The solution requires architectural separation:

1. **Source Preview**: Use HTML5 video (correct)
2. **Program Preview**: Build GPU compositor (required)
3. **Decode Pipeline**: Async workers with prefetch (essential)

This is not optional. This is how professional video editors work.

**Next Action**: Begin Phase 1 implementation immediately.
