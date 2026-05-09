# Implementation Roadmap: Architecture Separation

## Overview

This roadmap details the step-by-step implementation plan for separating Source Preview from Program Preview and building a professional-grade video editor architecture.

**Total Timeline**: 14-20 weeks **Priority**: Critical - Current architecture cannot scale

---

## PHASE 1: Tactical Stabilization (Weeks 1-2)

**Goal**: Stop performance bleeding, stabilize current system

### 1.1 Separate Preview Systems

**Create distinct components**:

```typescript
// src/components/editor/SourcePreviewEngine.tsx
// Handles single clip playback only
// Uses HTML5 video for playback
// Uses GPU scrubbing when paused

// src/components/editor/ProgramPreviewEngine.tsx
// Handles timeline rendering
// Multi-layer compositing
// Will evolve to GPU compositor
```

**Tasks**:

- [ ] Create `SourcePreviewEngine.tsx`
- [ ] Create `ProgramPreviewEngine.tsx`
- [ ] Move single-clip logic to SourcePreviewEngine
- [ ] Move timeline logic to ProgramPreviewEngine
- [ ] Update PreviewPanel to route to correct engine

**Acceptance Criteria**:

- Source preview uses HTML5 video for playback
- GPU scrubbing only activates when paused
- No manual decode during normal playback
- Clear separation between systems

### 1.2 Remove Manual Decode from Playback

**Current Problem**:

```typescript
// WRONG - Decoding every frame during playback
useEffect(() => {
  if (isPlaying) {
    requestAnimationFrame(() => {
      invoke("decode_frame_gpu", { time });
    });
  }
}, [isPlaying]);
```

**Fix**:

```typescript
// CORRECT - Let HTML5 video handle playback
<video
    ref={videoRef}
    src={clipSource}
    onPlay={() => setIsPlaying(true)}
    onPause={() => setIsPlaying(false)}
/>

// Only decode for scrubbing when paused
const handleScrub = async (time: number) => {
    if (!isPlaying) {
        const frame = await invoke("decode_frame_gpu", { time });
        renderFrame(frame);
    }
};
```

**Tasks**:

- [ ] Remove requestAnimationFrame decode loop
- [ ] Use HTML5 video for playback
- [ ] Only invoke decode_frame_gpu when paused
- [ ] Add scrubbing detection logic

**Acceptance Criteria**:

- Source preview plays at native speed
- No Rust calls during playback
- Scrubbing still works accurately
- Performance logs show zero decode during playback

### 1.3 Centralized Playback Clock

**Current Problem**: Each video element has independent timing

**Solution**: Single source of truth

```typescript
// src/lib/playback/PlaybackClock.ts
export class PlaybackClock {
  private currentTime: number = 0;
  private playbackRate: number = 1.0;
  private isPlaying: boolean = false;
  private startTime: number = 0;
  private listeners: Set<(time: number) => void> = new Set();

  play() {
    this.isPlaying = true;
    this.startTime = performance.now() - this.currentTime * 1000;
    this.tick();
  }

  pause() {
    this.isPlaying = false;
    this.currentTime = this.getCurrentTime();
  }

  private tick() {
    if (!this.isPlaying) return;

    const elapsed = (performance.now() - this.startTime) / 1000;
    this.currentTime = elapsed * this.playbackRate;

    this.notifyListeners(this.currentTime);
    requestAnimationFrame(() => this.tick());
  }

  subscribe(listener: (time: number) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(time: number) {
    this.listeners.forEach((listener) => listener(time));
  }

  getCurrentTime(): number {
    if (!this.isPlaying) return this.currentTime;
    const elapsed = (performance.now() - this.startTime) / 1000;
    return elapsed * this.playbackRate;
  }

  seek(time: number) {
    this.currentTime = time;
    if (this.isPlaying) {
      this.startTime = performance.now() - time * 1000;
    }
    this.notifyListeners(time);
  }
}
```

**Tasks**:

- [ ] Create PlaybackClock class
- [ ] Integrate with ProgramPreviewEngine
- [ ] Sync all video elements to clock
- [ ] Add clock controls to timeline

**Acceptance Criteria**:

- Single authoritative time source
- All videos sync to clock
- No drift between layers
- Seek operations affect all layers

### 1.4 Performance Monitoring

**Add metrics**:

```typescript
// src/lib/monitoring/PerformanceMonitor.ts
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  recordMetric(name: string, value: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(value);
  }

  getStats(name: string) {
    const values = this.metrics.get(name) || [];
    return {
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length,
    };
  }

  logReport() {
    console.group("Performance Report");
    this.metrics.forEach((_, name) => {
      const stats = this.getStats(name);
      console.log(`${name}:`, stats);
    });
    console.groupEnd();
  }
}
```

**Tasks**:

- [ ] Create PerformanceMonitor
- [ ] Track decode times
- [ ] Track frame render times
- [ ] Track IPC call frequency
- [ ] Add performance overlay (dev mode)

**Acceptance Criteria**:

- Real-time performance metrics visible
- Can identify bottlenecks quickly
- Metrics exportable for analysis

---

## PHASE 2: Playback Core (Weeks 3-6)

**Goal**: Build authoritative Rust-based timing and frame scheduling

### 2.1 Rust Playback Clock

```rust
// src-tauri/src/playback/clock.rs
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

pub struct PlaybackClock {
    current_time: Duration,
    playback_rate: f64,
    is_playing: bool,
    start_instant: Option<Instant>,
}

impl PlaybackClock {
    pub fn new() -> Self {
        Self {
            current_time: Duration::ZERO,
            playback_rate: 1.0,
            is_playing: false,
            start_instant: None,
        }
    }

    pub fn play(&mut self) {
        if !self.is_playing {
            self.is_playing = true;
            self.start_instant = Some(Instant::now());
        }
    }

    pub fn pause(&mut self) {
        if self.is_playing {
            self.current_time = self.get_current_time();
            self.is_playing = false;
            self.start_instant = None;
        }
    }

    pub fn get_current_time(&self) -> Duration {
        if !self.is_playing {
            return self.current_time;
        }

        if let Some(start) = self.start_instant {
            let elapsed = start.elapsed();
            let scaled = elapsed.as_secs_f64() * self.playback_rate;
            self.current_time + Duration::from_secs_f64(scaled)
        } else {
            self.current_time
        }
    }

    pub fn seek(&mut self, time: Duration) {
        self.current_time = time;
        if self.is_playing {
            self.start_instant = Some(Instant::now());
        }
    }

    pub fn set_playback_rate(&mut self, rate: f64) {
        if self.is_playing {
            self.current_time = self.get_current_time();
            self.start_instant = Some(Instant::now());
        }
        self.playback_rate = rate;
    }
}
```

**Tasks**:

- [ ] Implement PlaybackClock in Rust
- [ ] Add Tauri commands for clock control
- [ ] Integrate with frontend
- [ ] Add tests for timing accuracy

### 2.2 Frame Scheduler

```rust
// src-tauri/src/playback/scheduler.rs
use std::collections::VecDeque;
use std::time::Duration;

pub struct Frame {
    pub timestamp: Duration,
    pub texture_id: u32,
    pub width: u32,
    pub height: u32,
}

pub struct FrameScheduler {
    target_fps: f64,
    frame_queue: VecDeque<Frame>,
    max_queue_size: usize,
}

impl FrameScheduler {
    pub fn new(target_fps: f64) -> Self {
        Self {
            target_fps,
            frame_queue: VecDeque::new(),
            max_queue_size: 30, // 1 second at 30fps
        }
    }

    pub fn push_frame(&mut self, frame: Frame) -> Result<(), String> {
        if self.frame_queue.len() >= self.max_queue_size {
            return Err("Frame queue full".to_string());
        }
        self.frame_queue.push_back(frame);
        Ok(())
    }

    pub fn get_frame_at(&mut self, time: Duration) -> Option<Frame> {
        // Find closest frame to requested time
        let mut closest_idx = None;
        let mut closest_diff = Duration::MAX;

        for (idx, frame) in self.frame_queue.iter().enumerate() {
            let diff = if frame.timestamp > time {
                frame.timestamp - time
            } else {
                time - frame.timestamp
            };

            if diff < closest_diff {
                closest_diff = diff;
                closest_idx = Some(idx);
            }
        }

        closest_idx.and_then(|idx| self.frame_queue.remove(idx))
    }

    pub fn clear(&mut self) {
        self.frame_queue.clear();
    }

    pub fn queue_size(&self) -> usize {
        self.frame_queue.len()
    }
}
```

**Tasks**:

- [ ] Implement FrameScheduler
- [ ] Add frame queue management
- [ ] Implement frame selection logic
- [ ] Add queue monitoring

### 2.3 Timeline Resolver

```rust
// src-tauri/src/timeline/resolver.rs
use std::time::Duration;

pub struct Clip {
    pub id: String,
    pub source_path: String,
    pub start_time: Duration,
    pub end_time: Duration,
    pub source_start: Duration,
    pub track_index: usize,
}

pub struct TimelineResolver {
    clips: Vec<Clip>,
}

impl TimelineResolver {
    pub fn new() -> Self {
        Self { clips: Vec::new() }
    }

    pub fn add_clip(&mut self, clip: Clip) {
        self.clips.push(clip);
        // Sort by start time
        self.clips.sort_by_key(|c| c.start_time);
    }

    pub fn get_active_clips(&self, time: Duration) -> Vec<&Clip> {
        self.clips
            .iter()
            .filter(|clip| time >= clip.start_time && time < clip.end_time)
            .collect()
    }

    pub fn get_clips_in_range(&self, start: Duration, end: Duration) -> Vec<&Clip> {
        self.clips
            .iter()
            .filter(|clip| {
                // Clip overlaps with range
                clip.start_time < end && clip.end_time > start
            })
            .collect()
    }

    pub fn remove_clip(&mut self, clip_id: &str) {
        self.clips.retain(|c| c.id != clip_id);
    }

    pub fn clear(&mut self) {
        self.clips.clear();
    }
}
```

**Tasks**:

- [ ] Implement TimelineResolver
- [ ] Add clip management
- [ ] Implement active clip resolution
- [ ] Add range queries

### 2.4 Integration

**Tasks**:

- [ ] Connect PlaybackClock to FrameScheduler
- [ ] Connect TimelineResolver to decoder
- [ ] Add Tauri commands for timeline operations
- [ ] Update frontend to use Rust timing

**Acceptance Criteria**:

- Rust owns timing authority
- Frame scheduling operational
- Timeline resolver working
- Predictable frame delivery
- Frontend syncs to Rust clock

---

## PHASE 3: GPU Compositor (Weeks 7-14)

**Goal**: Replace DOM video layers with single GPU canvas

### 3.1 WebGPU Setup

```typescript
// src/lib/gpu/WebGPUContext.ts
export class WebGPUContext {
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  async initialize(): Promise<boolean> {
    if (!navigator.gpu) {
      console.error("WebGPU not supported");
      return false;
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      console.error("No GPU adapter found");
      return false;
    }

    this.device = await adapter.requestDevice();
    this.context = this.canvas.getContext("webgpu");

    if (!this.context) {
      console.error("Failed to get WebGPU context");
      return false;
    }

    const format = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format,
      alphaMode: "premultiplied",
    });

    return true;
  }

  getDevice(): GPUDevice {
    if (!this.device) throw new Error("Device not initialized");
    return this.device;
  }

  getContext(): GPUCanvasContext {
    if (!this.context) throw new Error("Context not initialized");
    return this.context;
  }
}
```

**Tasks**:

- [ ] Create WebGPU context manager
- [ ] Add device initialization
- [ ] Add error handling
- [ ] Add capability detection

### 3.2 Texture Manager

```typescript
// src/lib/gpu/TextureManager.ts
export class TextureManager {
  private device: GPUDevice;
  private textures: Map<string, GPUTexture> = new Map();

  constructor(device: GPUDevice) {
    this.device = device;
  }

  createTexture(id: string, width: number, height: number): GPUTexture {
    const texture = this.device.createTexture({
      size: { width, height },
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    this.textures.set(id, texture);
    return texture;
  }

  updateTexture(id: string, data: Uint8Array, width: number, height: number) {
    const texture = this.textures.get(id);
    if (!texture) {
      throw new Error(`Texture ${id} not found`);
    }

    this.device.queue.writeTexture({ texture }, data, { bytesPerRow: width * 4 }, { width, height });
  }

  getTexture(id: string): GPUTexture | undefined {
    return this.textures.get(id);
  }

  destroyTexture(id: string) {
    const texture = this.textures.get(id);
    if (texture) {
      texture.destroy();
      this.textures.delete(id);
    }
  }

  destroyAll() {
    this.textures.forEach((texture) => texture.destroy());
    this.textures.clear();
  }
}
```

**Tasks**:

- [ ] Implement TextureManager
- [ ] Add texture creation
- [ ] Add texture updates
- [ ] Add texture lifecycle management

### 3.3 Compositor Pipeline

```typescript
// src/lib/gpu/Compositor.ts
export class Compositor {
  private device: GPUDevice;
  private context: GPUCanvasContext;
  private pipeline: GPURenderPipeline;
  private textureManager: TextureManager;

  constructor(device: GPUDevice, context: GPUCanvasContext) {
    this.device = device;
    this.context = context;
    this.textureManager = new TextureManager(device);
    this.pipeline = this.createPipeline();
  }

  private createPipeline(): GPURenderPipeline {
    const shaderModule = this.device.createShaderModule({
      code: `
                struct VertexOutput {
                    @builtin(position) position: vec4<f32>,
                    @location(0) texCoord: vec2<f32>,
                }

                @vertex
                fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
                    var pos = array<vec2<f32>, 6>(
                        vec2<f32>(-1.0, -1.0),
                        vec2<f32>(1.0, -1.0),
                        vec2<f32>(-1.0, 1.0),
                        vec2<f32>(-1.0, 1.0),
                        vec2<f32>(1.0, -1.0),
                        vec2<f32>(1.0, 1.0),
                    );

                    var texCoord = array<vec2<f32>, 6>(
                        vec2<f32>(0.0, 1.0),
                        vec2<f32>(1.0, 1.0),
                        vec2<f32>(0.0, 0.0),
                        vec2<f32>(0.0, 0.0),
                        vec2<f32>(1.0, 1.0),
                        vec2<f32>(1.0, 0.0),
                    );

                    var output: VertexOutput;
                    output.position = vec4<f32>(pos[vertexIndex], 0.0, 1.0);
                    output.texCoord = texCoord[vertexIndex];
                    return output;
                }

                @group(0) @binding(0) var textureSampler: sampler;
                @group(0) @binding(1) var textureData: texture_2d<f32>;

                @fragment
                fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
                    return textureSample(textureData, textureSampler, input.texCoord);
                }
            `,
    });

    return this.device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module: shaderModule,
        entryPoint: "vertexMain",
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fragmentMain",
        targets: [
          {
            format: navigator.gpu.getPreferredCanvasFormat(),
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
      },
    });
  }

  render(layers: Array<{ textureId: string; transform: Transform }>) {
    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    renderPass.setPipeline(this.pipeline);

    // Render each layer
    for (const layer of layers) {
      const texture = this.textureManager.getTexture(layer.textureId);
      if (!texture) continue;

      // Create bind group for this layer
      const bindGroup = this.device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: this.device.createSampler({
              magFilter: "linear",
              minFilter: "linear",
            }),
          },
          {
            binding: 1,
            resource: texture.createView(),
          },
        ],
      });

      renderPass.setBindGroup(0, bindGroup);
      renderPass.draw(6);
    }

    renderPass.end();
    this.device.queue.submit([commandEncoder.finish()]);
  }
}
```

**Tasks**:

- [ ] Implement Compositor
- [ ] Create render pipeline
- [ ] Add shader support
- [ ] Implement multi-layer rendering

### 3.4 Integration with Rust

**Tasks**:

- [ ] Create shared texture interface
- [ ] Implement texture sharing between Rust/WebGPU
- [ ] Add frame delivery mechanism
- [ ] Optimize texture uploads

**Acceptance Criteria**:

- Single GPU canvas rendering
- Multiple layers composited
- Smooth playback
- No DOM video elements in timeline

---

## PHASE 4: Decode Architecture (Weeks 15-20)

**Goal**: Proper async decode pipeline with prefetching

### 4.1 Decoder Thread Pool

```rust
// src-tauri/src/decode/decoder_pool.rs
use std::sync::Arc;
use tokio::sync::mpsc;
use rayon::prelude::*;

pub struct DecodeRequest {
    pub clip_id: String,
    pub timestamp: Duration,
}

pub struct DecodedFrame {
    pub clip_id: String,
    pub timestamp: Duration,
    pub texture_id: u32,
    pub width: u32,
    pub height: u32,
}

pub struct DecoderPool {
    workers: usize,
    request_tx: mpsc::Sender<DecodeRequest>,
    frame_rx: mpsc::Receiver<DecodedFrame>,
}

impl DecoderPool {
    pub fn new(workers: usize) -> Self {
        let (request_tx, mut request_rx) = mpsc::channel(100);
        let (frame_tx, frame_rx) = mpsc::channel(100);

        // Spawn worker threads
        for _ in 0..workers {
            let mut rx = request_rx.clone();
            let tx = frame_tx.clone();

            tokio::spawn(async move {
                while let Some(request) = rx.recv().await {
                    // Decode frame
                    let frame = decode_frame_internal(request).await;
                    let _ = tx.send(frame).await;
                }
            });
        }

        Self {
            workers,
            request_tx,
            frame_rx,
        }
    }

    pub async fn request_decode(&self, request: DecodeRequest) {
        let _ = self.request_tx.send(request).await;
    }

    pub async fn get_decoded_frame(&mut self) -> Option<DecodedFrame> {
        self.frame_rx.recv().await
    }
}
```

**Tasks**:

- [ ] Implement decoder thread pool
- [ ] Add async decode workers
- [ ] Implement request queue
- [ ] Add frame delivery

### 4.2 Prefetch System

```rust
// src-tauri/src/decode/prefetcher.rs
pub struct Prefetcher {
    ahead_seconds: f64,
    behind_seconds: f64,
    decoder_pool: Arc<DecoderPool>,
    timeline_resolver: Arc<TimelineResolver>,
}

impl Prefetcher {
    pub fn new(
        ahead_seconds: f64,
        behind_seconds: f64,
        decoder_pool: Arc<DecoderPool>,
        timeline_resolver: Arc<TimelineResolver>,
    ) -> Self {
        Self {
            ahead_seconds,
            behind_seconds,
            decoder_pool,
            timeline_resolver,
        }
    }

    pub async fn prefetch_around(&self, current_time: Duration) {
        let start = current_time.saturating_sub(
            Duration::from_secs_f64(self.behind_seconds)
        );
        let end = current_time + Duration::from_secs_f64(self.ahead_seconds);

        let clips = self.timeline_resolver.get_clips_in_range(start, end);

        for clip in clips {
            // Calculate frames to prefetch
            let frame_rate = 30.0; // TODO: Get from clip metadata
            let frame_duration = Duration::from_secs_f64(1.0 / frame_rate);

            let mut time = start.max(clip.start_time);
            while time < end.min(clip.end_time) {
                self.decoder_pool.request_decode(DecodeRequest {
                    clip_id: clip.id.clone(),
                    timestamp: time,
                }).await;

                time += frame_duration;
            }
        }
    }
}
```

**Tasks**:

- [ ] Implement Prefetcher
- [ ] Add predictive decode logic
- [ ] Integrate with PlaybackClock
- [ ] Add prefetch window management

### 4.3 Hardware Acceleration

**Tasks**:

- [ ] Enable hardware decoding in FFmpeg
- [ ] Add VideoToolbox support (macOS)
- [ ] Add fallback to software decode
- [ ] Add decode capability detection

### 4.4 Frame Cache

```rust
// src-tauri/src/decode/frame_cache.rs
use lru::LruCache;

pub struct FrameCache {
    cache: LruCache<String, DecodedFrame>,
    max_size_mb: usize,
    current_size_mb: usize,
}

impl FrameCache {
    pub fn new(max_size_mb: usize) -> Self {
        Self {
            cache: LruCache::unbounded(),
            max_size_mb,
            current_size_mb: 0,
        }
    }

    pub fn insert(&mut self, key: String, frame: DecodedFrame) {
        let frame_size_mb = (frame.width * frame.height * 4) / (1024 * 1024);

        // Evict if necessary
        while self.current_size_mb + frame_size_mb as usize > self.max_size_mb {
            if let Some((_, _)) = self.cache.pop_lru() {
                self.current_size_mb -= frame_size_mb as usize;
            } else {
                break;
            }
        }

        self.cache.put(key, frame);
        self.current_size_mb += frame_size_mb as usize;
    }

    pub fn get(&mut self, key: &str) -> Option<&DecodedFrame> {
        self.cache.get(key)
    }

    pub fn clear(&mut self) {
        self.cache.clear();
        self.current_size_mb = 0;
    }
}
```

**Tasks**:

- [ ] Implement FrameCache
- [ ] Add LRU eviction
- [ ] Add size-based limits
- [ ] Add cache statistics

**Acceptance Criteria**:

- Async decode workers operational
- Frame prefetching working
- Hardware acceleration enabled
- 30fps sustained playback with 4K
- Frame cache reducing decode pressure

---

## Testing Strategy

### Phase 1 Tests

- [ ] Source preview plays at native speed
- [ ] No decode calls during playback
- [ ] Scrubbing accuracy
- [ ] Clock synchronization

### Phase 2 Tests

- [ ] Timing accuracy (±1ms)
- [ ] Frame scheduling correctness
- [ ] Timeline resolution accuracy
- [ ] Multi-clip synchronization

### Phase 3 Tests

- [ ] WebGPU initialization
- [ ] Multi-layer rendering
- [ ] Texture management
- [ ] Render performance

### Phase 4 Tests

- [ ] Decode worker pool
- [ ] Prefetch accuracy
- [ ] Cache hit rates
- [ ] Hardware decode fallback

---

## Success Metrics

### Performance Targets

**Phase 1**:

- Source preview: 30fps native playback
- Zero decode calls during playback
- <5ms clock sync accuracy

**Phase 2**:

- Frame scheduling: <1ms jitter
- Timeline resolution: <0.1ms
- Clock accuracy: ±1ms

**Phase 3**:

- GPU render: 60fps
- Multi-layer (4 layers): 30fps
- Texture upload: <5ms

**Phase 4**:

- 4K decode: <33ms per frame
- Cache hit rate: >80%
- Prefetch accuracy: >90%

---

## Risk Mitigation

### High-Risk Areas

1. **WebGPU Browser Support**
   - Mitigation: Fallback to Canvas2D
   - Detection: Capability check on startup

2. **Hardware Decode Availability**
   - Mitigation: Software decode fallback
   - Detection: Probe capabilities

3. **Texture Sharing Rust/WebGPU**
   - Mitigation: Use intermediate buffer
   - Alternative: Direct texture sharing via wgpu

4. **Performance Regression**
   - Mitigation: Continuous benchmarking
   - Rollback: Keep Phase 1 stable

---

## Conclusion

This roadmap transforms the architecture from a DOM-based video player into a professional realtime media compositor. Each phase builds on the previous, with clear acceptance criteria and fallback plans.

**Next Action**: Begin Phase 1, Task 1.1 - Create separate preview systems.
