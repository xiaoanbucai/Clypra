# Clypra Performance Implementation Plan

## Stacked Video Playback Optimization

**Status**: Approved for Phase 0 and Phase 1 Architecture  
**Last Updated**: 2026-07-09  
**Owner**: Engineering Team

---

## Executive Summary

This document defines a pragmatic, evidence-based approach to improving preview performance for stacked video playback in Clypra. The plan prioritizes architectural fixes to the existing `HTMLVideoElement` + Pixi pipeline before considering more complex alternatives like WebCodecs or native rendering.

### Key Principles

1. **Pixi is the right compositor** — retain the scene graph architecture
2. **Decouple media scheduling from rendering** — never wait for decode
3. **Measure before migrating** — no WebCodecs until benchmarks prove necessity
4. **Preserve editorial semantics** — quality degradation must not hide layers
5. **Proxy-first strategy** — predictable performance requires proxy workflow

---

## Phase 0: Benchmark & Diagnosis

**Goal**: Identify the dominant bottleneck on representative hardware with quantifiable evidence.

### 0.1 Performance Instrumentation

Build comprehensive telemetry to capture:

#### Frame Timing Metrics

```typescript
interface FrameMetrics {
  // Overall performance
  rafInterval: number; // Time since last RAF (target: 16.67ms @ 60fps)
  p50FrameTime: number; // Median frame time
  p95FrameTime: number; // 95th percentile (critical metric)
  p99FrameTime: number; // 99th percentile
  droppedFrames: number; // Frames that exceeded budget

  // Pipeline breakdown
  sceneEvalTime: number; // Timeline evaluation duration
  mediaSyncTime: number; // Video synchronization duration
  pixiComposeTime: number; // GPU composition duration

  // Media decoder state
  activeDecoders: number; // Currently decoding videos
  decoderBudget: number; // Hardware decoder limit
  aggregateDecodeRate: number; // Frames decoded/sec across all videos
  aggregatePresentRate: number; // Frames presented/sec
  staleFrameReuse: number; // % of frames using old texture

  // Seek behavior
  seeksPerClipPerSecond: Map<string, number>; // Per-clip seek rate
  medianSeekLatency: number; // Time from seek to canplaythrough
  p95SeekLatency: number; // 95th percentile seek time

  // Resource pressure
  textureUploadCount: number; // GPU uploads this frame
  textureUploadBytes: number; // Estimated bandwidth used
  gcPauseTime: number; // JS garbage collection time
}
```

#### Performance Overlay

Display real-time metrics in preview:

```
┌─────────────────────────────────────────────────────┐
│ Preview: 29.8 fps | p95: 41ms | Quality: Balanced   │
│ Active videos: 3/3 decoder budget                   │
│ Decoded: 81 fps aggregate | Presented: 75 fps       │
│ Seeks: 0.3/s | Stale reuse: 4.1%                    │
│ Scene: 1.8ms | Media sync: 0.4ms | Pixi: 3.2ms      │
└─────────────────────────────────────────────────────┘
```

#### Trace Export

Export detailed traces to JSON for offline analysis:

- Per-frame timeline with all sub-operations
- Seek event log with reasons and latencies
- Texture update log with source and size
- Dropped frame analysis with root causes

### 0.2 Benchmark Matrix

Test representative scenarios on target hardware:

| Scenario | Source                           | Stack      | Expected Use           |
| -------- | -------------------------------- | ---------- | ---------------------- |
| A        | 720p H.264, 30fps                | 1-6 layers | Baseline               |
| B        | 1080p H.264, 30fps               | 1-5 layers | Primary target         |
| C        | 4K H.264/H.265                   | 1-3 layers | Stress case            |
| D        | Mixed video + image + transforms | 4-8 layers | Scene complexity       |
| E        | Video + filters/masks/blends     | 3-5 layers | GPU/effect stress      |
| F        | Continuous playback vs scrub     | 3-4 layers | Seek policy validation |

### 0.3 Exit Criteria

Must answer these questions with data:

1. **Decoder Capacity**: How many simultaneous HD videos can hardware decode at 30fps?
2. **Seek Storm**: How many `currentTime` assignments occur per second per clip?
3. **Texture Pressure**: Is GPU bandwidth saturated by redundant uploads?
4. **Bottleneck**: Does p95 frame time correlate with decoder stalls, seeks, Pixi time, or GC?
5. **Scrubbing**: Is seek latency acceptable, or does frame availability lag unacceptably?

**Deliverable**: Performance report identifying the primary bottleneck with supporting data.

---

## Phase 1: Stabilize HTMLVideoElement + Pixi Pipeline

**Goal**: Smooth 3-4 stacked 1080p proxy videos at 30fps on target hardware.

### Architecture Redesign

#### 1.1 Three-Clock Architecture

**Current Problem**: One RAF loop couples timeline clock, media synchronization, and rendering. When decode falls behind, synchronization triggers more seeks, creating a feedback loop that worsens performance.

**Solution**: Separate timing concerns into three independent clocks:

```typescript
// Timeline Clock: Authoritative playhead position
class TimelineClock {
  private playbackStartTimelineTime: number;
  private playbackStartWallTime: number;
  private playbackRate: number;

  getCurrentPlayhead(): number {
    return this.playbackStartTimelineTime + ((performance.now() - this.playbackStartWallTime) / 1000) * this.playbackRate;
  }
}

// Media Clock: Per-clip alignment (low-frequency control loop)
class MediaClock {
  checkDrift(videoElement: HTMLVideoElement, targetTime: number): DriftState {
    const drift = Math.abs(videoElement.currentTime - targetTime);

    if (drift < 0.08) return { action: "none" };
    if (drift < 0.2) return { action: "converge" }; // Let natural playback catch up
    return { action: "hard-seek", targetTime }; // Only after repeated violations
  }
}

// Render Clock: Pixi composition at display cadence (never waits)
class RenderClock {
  render(): void {
    // Always render newest available frame
    // If media is late, hold previous frame
    // Never block on decode
  }
}
```

**Critical Rule**: During continuous playback, allow videos to play natively. Only seek on discontinuities:

- Transport jump (play/pause/seek)
- Scrubbing
- Clip enter/exit
- Trim change
- Speed change
- Drift recovery (>200ms for 2-3 consecutive samples)

#### 1.2 PreviewPlaybackScheduler

**Current Problem**: Direct coupling between timeline evaluation and `PreviewMediaPool` creates uncontrolled seek activity.

**Solution**: Introduce explicit scheduler between evaluation and media pool:

```typescript
interface MediaAction {
  type: "play" | "pause" | "seek" | "setPlaybackRate" | "prewarm" | "release" | "freeze";
  clipId: string;
  sourceTime?: number;
  rate?: number;
  reason?: SeekReason;
}

type SeekReason = "transport-jump" | "scrub" | "clip-enter" | "trim-change" | "rate-change" | "drift-recovery";

class PreviewPlaybackScheduler {
  // Policy-driven media control
  scheduleActions(timelineState: TimelineState, mediaStates: Map<string, MediaState>): MediaAction[] {
    const actions: MediaAction[] = [];

    // Continuous playback policy
    for (const [clipId, state] of mediaStates) {
      const drift = this.calculateDrift(state, timelineState.playhead);

      if (drift < 0.08) {
        // Within tolerance - do nothing
        continue;
      } else if (drift < 0.2 && state.consecutiveDriftSamples < 3) {
        // Minor drift - let converge
        state.consecutiveDriftSamples++;
        continue;
      } else if (drift >= 0.2 && state.consecutiveDriftSamples >= 2) {
        // Persistent drift - hard seek
        actions.push({
          type: "seek",
          clipId,
          sourceTime: this.calculateTargetTime(clipId, timelineState),
          reason: "drift-recovery",
        });
      }
    }

    return actions;
  }

  // Scrubbing uses throttled policy
  private scrubThrottle = new Map<string, number>();

  handleScrub(clipId: string, targetTime: number): MediaAction | null {
    const now = performance.now();
    const lastSeek = this.scrubThrottle.get(clipId) ?? 0;

    // Cap scrub seeks to 10-15 per second
    if (now - lastSeek < 66) return null;

    this.scrubThrottle.set(clipId, now);
    return { type: "seek", clipId, sourceTime: targetTime, reason: "scrub" };
  }
}
```

**Seek Policy by Situation**:

| Situation                           | Action                                    |
| ----------------------------------- | ----------------------------------------- |
| Continuous playback, drift < 80ms   | Do nothing                                |
| Continuous playback, drift 80-200ms | Let converge naturally                    |
| Drift > 200ms for 2-3 samples       | One hard seek                             |
| Playhead jump                       | Seek all newly active clips once          |
| Scrubbing                           | Pause videos; seek at 10-15 Hz max        |
| Clip inactive                       | Pause; retain in warm cache               |
| Clip enters within look-ahead       | Preload metadata                          |
| Decoder budget exceeded             | Use proxy or freeze lowest-priority layer |

#### 1.3 requestVideoFrameCallback Integration

**Current Problem**: `texture.source.update()` called for every video on every RAF, causing redundant GPU uploads.

**Solution**: Use native frame callback API to update only when new frames arrive:

```typescript
class VideoTextureManager {
  private frameStates = new Map<string, VideoFrameState>();

  attachVideo(clipId: string, video: HTMLVideoElement, texture: Texture): void {
    const state: VideoFrameState = {
      latestMediaTime: 0,
      frameSerial: 0,
      textureDirty: false,
    };

    this.frameStates.set(clipId, state);

    // Register callback for actual decoded frames
    const callback = (_now: number, metadata: VideoFrameCallbackMetadata) => {
      state.latestMediaTime = metadata.mediaTime;
      state.frameSerial++;
      state.textureDirty = true;

      // Re-register for next frame
      video.requestVideoFrameCallback(callback);
    };

    video.requestVideoFrameCallback(callback);
  }

  updateTextures(records: Map<string, SpriteRecord>): TextureUpdateStats {
    let updated = 0;
    let skipped = 0;

    for (const [clipId, record] of records) {
      const state = this.frameStates.get(clipId);
      if (!state) continue;

      if (state.textureDirty) {
        record.texture.source.update();
        state.textureDirty = false;
        updated++;
      } else {
        skipped++;
      }
    }

    return { updated, skipped, staleReuseRate: skipped / (updated + skipped) };
  }
}
```

**Expected Impact**:

- At 60 Hz display with 30fps sources: ~50% reduction in texture uploads
- At 30 Hz display with 30fps sources: Eliminates redundant uploads entirely
- Frame presentation driven by availability, not speculation

#### 1.4 Adaptive Quality Governor

**Current Problem**: No graceful degradation when decoder capacity is exceeded.

**Solution**: Quality ladder that preserves composition semantics:

| Tier         | Decode Resolution   | Effects                       | Preview FPS | Layer Behavior     |
| ------------ | ------------------- | ----------------------------- | ----------- | ------------------ |
| **Full**     | Original/proxy-high | Full                          | 30/60       | All layers         |
| **Balanced** | 720p / ½ proxy      | Expensive filters reduced     | 30          | All layers         |
| **Draft**    | 360p/480p proxy     | Disable non-essential filters | 24/30       | All layers         |
| **Survival** | Lowest proxy        | Freeze late background frames | 15/24       | All layers visible |

**Critical Rule**: Never hide layers. Only freeze a layer if it is demonstrably late AND lower priority.

**Priority Calculation**:

```typescript
function calculateLayerPriority(layer: EvaluatedLayer): number {
  let priority = 0;

  // Visibility trumps all
  if (!layer.visible) return -1000;

  // Opacity contribution
  priority += layer.opacity * 100;

  // Track order (lower = higher priority in NLE)
  priority += (maxTrack - layer.trackIndex) * 50;

  // Screen coverage
  priority += calculateScreenCoverage(layer) * 30;

  // Audio relevance
  if (layer.hasActiveAudio) priority += 200;

  // Effect cost (inverse - lower cost = higher priority)
  priority -= estimateEffectCost(layer) * 0.1;

  return priority;
}
```

**Occlusion Detection**: Only freeze fully occluded layers with no effects/masks/blend modes/audio.

### 1.5 Implementation Tasks

#### Core Architecture

- [ ] Extract `TimelineClock` with authoritative playhead calculation
- [ ] Build `PreviewPlaybackScheduler` with policy-driven seek control
- [ ] Implement `VideoTextureManager` with `requestVideoFrameCallback`
- [ ] Add drift detection with threshold-based seek policy
- [ ] Remove per-frame `currentTime` synchronization during playback

#### Quality Management

- [ ] Define quality tier profiles (Full/Balanced/Draft/Survival)
- [ ] Implement layer priority calculation
- [ ] Build occlusion detection for safe layer freezing
- [ ] Add auto-quality switching based on frame metrics
- [ ] Create manual quality selector UI

#### Observability

- [ ] Build `PerformanceMonitor` with frame timing breakdown
- [ ] Add real-time performance overlay
- [ ] Implement trace export to JSON
- [ ] Create offline analysis tools
- [ ] Add dropped frame event log with root causes

#### Testing & Validation

- [ ] Benchmark suite for all Phase 0 scenarios
- [ ] Automated regression detection
- [ ] Performance dashboard
- [ ] Before/after comparison tooling

### 1.6 Success Criteria

Must achieve on target hardware with 4× 1080p H.264 @ 30fps:

- **p95 frame time**: < 35ms (30fps target)
- **Dropped frames**: < 1% during continuous playback
- **Seek rate**: < 0.5 seeks/second/clip during playback
- **Stale frame reuse**: < 5% (acceptable cache hit rate)
- **Scrubbing**: Seek latency p95 < 150ms
- **No freezes**: Preview never blocks for > 100ms

**Deliverable**: Stable preview with predictable performance and comprehensive metrics.

---

## Phase 2: Proxy Workflow

**Goal**: Make performance predictable across arbitrary user media.

### 2.1 Rationale

**Reality Check**: Expecting 4× 4K H.264/H.265 decode in browser `<video>` elements is not a renderer problem — it's a codec/hardware budget problem.

**Solution**: Proxy workflow is not an "alternative" — it's a core capability for professional editing.

### 2.2 Proxy Strategy

#### Proxy Specifications

```typescript
interface ProxyProfile {
  name: "high" | "medium" | "low";
  maxResolution: { width: number; height: number };
  codec: "h264" | "h265";
  profile: "baseline" | "main" | "high";
  gopSize: number; // Keyframe interval for seek performance
  bitrate: number;
}

const PROXY_PROFILES: ProxyProfile[] = [
  {
    name: "high",
    maxResolution: { width: 1920, height: 1080 },
    codec: "h264",
    profile: "main",
    gopSize: 15, // Keyframe every 0.5s @ 30fps
    bitrate: 5_000_000,
  },
  {
    name: "medium",
    maxResolution: { width: 1280, height: 720 },
    codec: "h264",
    profile: "main",
    gopSize: 15,
    bitrate: 2_500_000,
  },
  {
    name: "low",
    maxResolution: { width: 854, height: 480 },
    codec: "h264",
    profile: "baseline",
    gopSize: 15,
    bitrate: 1_000_000,
  },
];
```

#### Key Requirements

1. **Browser-Friendly GOP**: Short keyframe intervals enable fast seeking
2. **Baseline/Main Profile**: Maximum compatibility across decoders
3. **Background Generation**: Non-blocking proxy creation
4. **Original Preservation**: Always export from original media
5. **Dynamic Switching**: Change proxy tier based on quality governor

### 2.3 Implementation

#### Proxy Generation Service

```typescript
class ProxyGenerationService {
  async generateProxy(sourceMedia: MediaAsset, profile: ProxyProfile, onProgress: (percent: number) => void): Promise<ProxyAsset> {
    // Use FFmpeg WASM or server-side generation
    // Store in IndexedDB or cloud storage
    // Update media pool mapping
  }

  async generateAllProxies(sourceMedia: MediaAsset, profiles: ProxyProfile[]): Promise<Map<string, ProxyAsset>> {
    // Generate multiple proxy tiers in parallel
    // Priority: medium > low > high
  }
}
```

#### Media Pool Integration

```typescript
class ProxyAwareMediaPool extends PreviewMediaPool {
  resolveMediaSource(clip: Clip, qualityTier: QualityTier): MediaSource {
    // Check if proxy is available for quality tier
    const proxy = this.proxyCache.get(clip.mediaId, qualityTier);

    if (proxy?.status === "ready") {
      return proxy.source;
    } else if (proxy?.status === "generating") {
      // Use lower tier proxy or original while generating
      return this.fallbackSource(clip, qualityTier);
    } else {
      // Trigger background generation
      this.requestProxyGeneration(clip.mediaId, qualityTier);
      return clip.originalSource;
    }
  }
}
```

#### UI Indicators

- Proxy generation progress in media library
- Quality tier badge on timeline clips
- "Generating proxies..." status bar
- Auto-proxy on import option (user preference)

### 2.4 Success Criteria

- **Performance**: 6× 4K sources play smoothly via 720p proxies
- **Quality**: Proxy quality acceptable for editorial decisions
- **Generation**: Proxy creation completes in < 2× realtime
- **Storage**: Proxy cache management with eviction policy
- **Export**: Always uses original media (verify no proxy leakage)

**Deliverable**: Production-ready proxy workflow with background generation.

---

## Phase 3: WebCodecs Experimental Backend (Conditional)

**Goal**: Determine if WebCodecs materially improves on optimized `<video>` pipeline.

### 3.1 When to Consider This Phase

**Do NOT proceed unless**:

1. Phase 1 improvements still fail to meet performance targets
2. Benchmark data proves decoder capacity (not architecture) is the bottleneck
3. Target use cases require > 6 simultaneous HD streams
4. Team capacity exists for 2-3 month engineering investment

### 3.2 Scope Limitations

**Build feature-flagged experimental backend only**:

```typescript
interface VideoBackend {
  createDecoder(clip: Clip): VideoDecoder;
  decodeFrame(decoder: VideoDecoder, timestamp: number): VideoFrame | null;
  presentFrame(frame: VideoFrame, texture: Texture): void;
}

// Parallel implementations
class HTMLVideoBackend implements VideoBackend {
  /* existing */
}
class WebCodecsBackend implements VideoBackend {
  /* experimental */
}
```

**Initial Constraints**:

- One codec/container path only (H.264 MP4)
- Video-only preview (no audio initially)
- Fixed frame-rate media only
- Small ring buffer (3-5 frames)
- No full migration until proven

### 3.3 Complexity Acknowledgment

WebCodecs does NOT provide:

- ❌ Demuxing (need MP4Box.js or custom parser)
- ❌ Codec configuration parsing
- ❌ Keyframe indexing for seeking
- ❌ Audio synchronization
- ❌ Frame lifetime management
- ❌ Fallback for unsupported codecs
- ❌ Texture sharing (requires careful memory management)

**Engineering Cost**: 2-3 months for production-ready implementation.

### 3.4 Evaluation Criteria

Must demonstrate **measurable improvement** over Phase 1 optimized pipeline:

| Metric                   | Phase 1 Baseline | WebCodecs Target | Threshold        |
| ------------------------ | ---------------- | ---------------- | ---------------- |
| Concurrent 1080p streams | 4-6              | 8-10             | +50% minimum     |
| p95 frame time           | 35ms             | 25ms             | -25% improvement |
| Seek latency (p95)       | 150ms            | 80ms             | -45% improvement |
| Memory footprint         | Baseline         | < 1.5× baseline  | Must not explode |

**Decision Point**: If WebCodecs cannot show > 40% improvement on critical metrics, abandon and focus on Phase 2 proxy workflow.

**Deliverable**: Benchmark report with recommendation to proceed or abandon WebCodecs.

---

## Phase 4: Platform-Native Preview (Strategic Decision)

**Goal**: Desktop-professional playback for demanding workflows.

### 4.1 When to Consider

Only if Clypra explicitly targets:

- 6+ simultaneous 1080p original (non-proxy) streams
- 4K multicam editing
- Heavy real-time effects
- Premiere/Resolve-class expectations
- Desktop-only deployment acceptable

### 4.2 Technical Scope

This is a **separate rendering platform**, not an optimization:

- Platform-specific decode paths (VideoToolbox, NVDEC, DXVA)
- GPU interop (Metal, Vulkan, D3D)
- Color management
- A/V synchronization
- Effect execution
- Proxy handling
- Export parity

**Engineering Cost**: 6-12 months for production-ready implementation.

### 4.3 Architecture

```
┌─────────────────────────────────────┐
│   Tauri/Electron Main Process       │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ Native Decode Service         │ │
│  │  - FFmpeg decode              │ │
│  │  - Hardware acceleration      │ │
│  │  - Frame buffer management    │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ Native Compositor             │ │
│  │  - GPU-accelerated rendering  │ │
│  │  - Effect pipeline            │ │
│  │  - Texture streaming to UI    │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
           ↕ IPC
┌─────────────────────────────────────┐
│   Browser Renderer Process          │
│  - UI and timeline only             │
│  - Receives rendered frames         │
└─────────────────────────────────────┘
```

### 4.4 Decision Criteria

**Approve only if**:

- Product roadmap requires desktop-pro performance
- Browser limitations proven insurmountable via Phases 1-2
- Budget exists for platform engineering team
- Willing to maintain two rendering backends

**Deliverable**: Multi-platform native rendering with desktop-class performance.

---

## Non-Negotiable Constraints

These apply to ALL phases:

1. ✅ **No per-frame seeks** — `currentTime` assignment only on discontinuities during playback
2. ✅ **No texture polling** — Use `requestVideoFrameCallback`, not RAF-driven updates
3. ✅ **Pixi never waits** — Render newest available frame, never block on decode
4. ✅ **Preserve layer visibility** — Quality degradation must not hide layers
5. ✅ **Proxy is core** — Not an afterthought, but primary performance strategy
6. ✅ **WebCodecs requires proof** — No migration without benchmark evidence
7. ✅ **Canonical contract** — Preview and export share timeline/compositor semantics

---

## Approval Status

- ✅ **Phase 0**: Approved for immediate start
- ✅ **Phase 1**: Architecture approved, implementation authorized
- ⏸️ **Phase 2**: Approved in principle, start after Phase 1 validation
- ❌ **Phase 3**: Blocked until Phase 1 + 2 complete and benchmarks justify
- ❌ **Phase 4**: Strategic decision required, not currently approved

---

## Timeline Estimate

| Phase   | Duration    | Dependencies                         |
| ------- | ----------- | ------------------------------------ |
| Phase 0 | 1-2 weeks   | None                                 |
| Phase 1 | 4-6 weeks   | Phase 0 complete                     |
| Phase 2 | 3-4 weeks   | Phase 1 validated                    |
| Phase 3 | 8-12 weeks  | Conditional approval + team capacity |
| Phase 4 | 6-12 months | Product decision + platform team     |

**Critical Path**: Phase 0 → Phase 1 → Phase 2

---

## Success Metrics

### Phase 1 Target (Must Achieve)

With 4× 1080p H.264 @ 30fps on target hardware:

- p95 frame time < 35ms
- Dropped frames < 1% during playback
- Seek rate < 0.5/sec/clip during playback
- No preview freezes > 100ms

### Phase 2 Target (Proxy Workflow)

With 6× 4K H.265 sources via 720p proxies:

- Same performance as Phase 1 metrics
- Proxy generation < 2× realtime
- Zero proxy leakage in exports

### Overall Product Goal

Professional editing experience:

- Smooth preview during multicam editing
- Responsive scrubbing
- Predictable performance across user media
- Clear quality/performance tradeoffs exposed to user

---

## Next Actions

1. **Immediate**: Begin Phase 0 instrumentation and benchmark suite
2. **Week 2**: Review Phase 0 data and confirm Phase 1 priorities
3. **Week 4**: Start Phase 1 architecture implementation
4. **Week 10**: Validate Phase 1 improvements and decide Phase 2 start
5. **Week 14**: Phase 3 decision point based on cumulative data

---

## Appendix: Technical References

### Corrected Understanding: video.currentTime Assignment

**Misconception**: `video.currentTime = X` blocks main thread for 10-50ms  
**Reality**: Assignment is async — initiates seek, decode happens later

**The actual problem**: Seek churn + decode starvation, not JavaScript blocking.

**Correct mitigation**: Eliminate unnecessary seeks, not "batch" assignments.

### requestVideoFrameCallback Browser Support

- Chrome/Edge: ✅ Supported since 2020
- Firefox: ✅ Supported since 2023
- Safari: ✅ Supported since iOS 15.4

**Compatibility**: Safe to use for Clypra's target platforms.

### Decoder Hardware Limits

Typical consumer hardware:

- **2-4 HD streams**: Most integrated GPUs
- **4-6 HD streams**: Dedicated GPUs
- **8+ HD streams**: Workstation-class hardware

**Reality**: No browser decoder pool will make 10× 4K streams smooth without proxies.
