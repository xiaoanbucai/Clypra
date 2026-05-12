# Sequence Space Architecture - Professional NLE Design

## The Core Principle

Professional NLEs (Premiere, Resolve, FCP) strictly separate:

```
Source Media Space  ≠  Sequence Space  ≠  Viewport Space
```

This is **fundamental** to professional compositing workflows.

## The Three Spaces

### 1. Source Space

- Raw media dimensions (never changes)
- Example: 1920x1080, 3840x2160, 720x1280
- Immutable - represents the actual file

### 2. Sequence Space (THE UNIVERSE)

- The editing canvas / coordinate system
- Defined by project settings: `canvasWidth` x `canvasHeight`
- **Stays fixed** regardless of clips added
- This is where ALL compositing happens

### 3. Viewport Space

- Display/preview fitting (UI only)
- How the editor visualizes sequence space
- Modes: fit, fill, zoom levels
- Does NOT affect render output

## Why This Matters

### The Mental Model

```
Source Media
    ↓
Clip Transform (scale, position, rotation)
    ↓
Sequence Space (the coordinate universe)
    ↓
Program Monitor (visualization)
    ↓
Export (sequence dimensions)
```

**NOT:**

```
❌ Program monitor resizes itself per clip
❌ Sequence dimensions emerge from clips
❌ Preview adapts to media
```

### What Breaks Without This

If preview dimensions changed per frame:

1. **Overlays break** - Text/graphics positioned for 16:9 suddenly wrong in 9:16
2. **Motion graphics break** - Animations designed for one aspect ratio fail
3. **Transitions break** - Cross-dissolves between different aspect ratios undefined
4. **Export undefined** - What dimensions should the output be?
5. **Compositing impossible** - Can't layer effects predictably

## Professional NLE Behavior

### Sequence Settings Are Explicit

**Adobe Premiere Pro:**

- Sequence → Sequence Settings
- Resolution, FPS, color space, pixel aspect ratio
- Can create sequence from clip (convenience)
- But once set, stays fixed

**DaVinci Resolve:**

- Project Settings → Timeline Format
- Very strict separation:
  - Media pool (source space)
  - Timeline format (sequence space)
  - Monitoring format (viewport space)
  - Delivery format (export space)

**Final Cut Pro:**

- Project Properties
- Uses "smart conform" but still sequence-driven internally
- Automatic but predictable

### Common Pattern: "Create Sequence From Clip"

Many NLEs offer this convenience:

```typescript
// User drags first clip to empty timeline
if (timeline.isEmpty()) {
  // OPTIONAL: Auto-create sequence matching clip
  sequence.width = clip.sourceWidth;
  sequence.height = clip.sourceHeight;
  sequence.fps = clip.sourceFPS;
}
```

But this is:

- **Initial configuration convenience**
- **NOT ongoing dynamic behavior**
- Once sequence exists, it stays fixed

### Example Workflow

```
1. Create sequence: 1080x1920 (9:16 portrait)
2. Add clips:
   - Clip A: 1920x1080 (16:9 landscape) → letterboxed
   - Clip B: 3840x2160 (4K 16:9) → letterboxed + scaled
   - Clip C: 720x1280 (9:16 portrait) → scaled to fit
   - Clip D: 1080x1080 (1:1 square) → pillarboxed

3. Program monitor ALWAYS shows 1080x1920
4. Export is ALWAYS 1080x1920
5. Clips transform to fit sequence space
```

## The Bug We Fixed

### What Was Wrong

The "Original" preview mode was **incorrectly** reading from clip media:

```typescript
// ❌ WRONG - Adapts to clip media
function resolveOriginalPreviewAspect(layers, mediaAssets, canvasWidth, canvasHeight) {
  if (layers.length === 1) {
    const asset = mediaAssets.find((a) => a.id === layers[0].mediaId);
    return asset.width / asset.height; // ← Reading from clip!
  }
  return canvasWidth / canvasHeight;
}
```

This caused:

- Preview dimensions changing based on clips
- Inconsistent behavior (works with 1 clip, breaks with 2+)
- Violates professional NLE principles

### What We Fixed

```typescript
// ✅ CORRECT - Always uses sequence dimensions
function resolveOriginalPreviewAspect(layers, mediaAssets, canvasWidth, canvasHeight) {
  // Always return sequence aspect ratio
  // The sequence is the coordinate universe - it doesn't change based on clips
  return canvasWidth / Math.max(1, canvasHeight);
}
```

Now:

- "Original" mode shows sequence aspect ratio
- Consistent regardless of clip count
- Matches professional NLE behavior
- Sequence space is stable

## Clypra's Current Architecture

### Project Structure

```typescript
interface Project {
  id: string;
  name: string;
  aspectRatio: AspectRatio;
  canvasWidth: number; // ← Sequence width
  canvasHeight: number; // ← Sequence height
  frameRate: 24 | 30 | 60;
  duration: number;
}
```

### Clip Structure

```typescript
interface Clip {
  id: string;
  mediaId: string;
  // Transform in sequence space
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  // Timing
  startTime: number;
  duration: number;
  trimIn: number;
  trimOut: number;
}
```

### Rendering Pipeline

```
1. Source Media (asset.width x asset.height)
   ↓
2. Clip Transform (clip.x, clip.y, clip.width, clip.height)
   ↓
3. Sequence Space (project.canvasWidth x project.canvasHeight)
   ↓
4. Scene Evaluation (evaluateScene)
   ↓
5. Rasterization (rasterizeScene)
   ↓
6. Program Monitor Display
   ↓
7. Export (same as sequence dimensions)
```

## Preview Aspect Ratio Modes

### What They Mean (Correctly)

| Mode         | Meaning               | Viewport Behavior                  |
| ------------ | --------------------- | ---------------------------------- |
| **Original** | Sequence aspect ratio | Shows full sequence canvas         |
| **16:9**     | 16:9 viewport         | Crops/fits sequence to 16:9 view   |
| **9:16**     | 9:16 viewport         | Crops/fits sequence to 9:16 view   |
| **1:1**      | Square viewport       | Crops/fits sequence to square view |

**Key Point:** These are **viewport display modes**, not sequence settings!

### What "Original" Does NOT Mean

- ❌ Source media aspect ratio
- ❌ First clip aspect ratio
- ❌ Dynamic aspect based on clips

### If Users Want Source Aspect Ratio

They should use **Source Preview mode**, which shows:

- Individual media files
- Original dimensions
- No compositing
- No sequence context

## Professional Compositing Analogy

Think of sequence space like:

### Game Engine Rendering

```
World Space (sequence)
  ↓
Camera View (viewport)
  ↓
Screen Display
```

The world doesn't change size based on what's in it.

### Photoshop Canvas

```
Canvas Size (sequence)
  ↓
Layers (clips)
  ↓
Zoom/View (viewport)
```

The canvas stays fixed. Layers fit within it.

### After Effects Composition

```
Composition Settings (sequence)
  ↓
Layers (clips)
  ↓
Preview Resolution (viewport)
```

Composition dimensions are explicit and stable.

## Future Enhancements

### 1. Explicit Sequence Settings UI

Add UI for changing sequence settings:

- Resolution presets (1080p, 4K, 9:16, etc.)
- Custom dimensions
- Frame rate
- Color space
- Pixel aspect ratio

### 2. Multiple Sequences Per Project

Professional workflow:

```
Project
  ├── Sequence 1 (1920x1080 main edit)
  ├── Sequence 2 (1080x1920 social media)
  └── Sequence 3 (3840x2160 4K master)
```

### 3. Nested Sequences

Sequences as clips in other sequences:

```
Main Sequence (1920x1080)
  ├── Intro Sequence (1920x1080)
  ├── Main Content
  └── Outro Sequence (1920x1080)
```

### 4. Proxy Rendering

Separate dimensions for:

- Playback preview (1/2 or 1/4 resolution)
- Export (full resolution)
- Monitoring (display resolution)

### 5. Smart Conform Presets

Per-clip fit mode overrides:

- Contain (default)
- Cover (fill)
- Stretch
- Custom transform

## Testing Checklist

### Sequence Space Stability

- [ ] Create 9:16 sequence
- [ ] Add 16:9 clip → letterboxed
- [ ] Add 9:16 clip → scaled to fit
- [ ] Add 1:1 clip → pillarboxed
- [ ] Switch preview to "Original" → shows 9:16 (sequence aspect)
- [ ] Switch preview to "16:9" → crops sequence to 16:9 view
- [ ] Export → 9:16 output (sequence dimensions)

### Preview Mode Consistency

- [ ] "Original" mode always shows sequence aspect
- [ ] "Original" mode doesn't change with different clips
- [ ] Other aspect modes are viewport-only
- [ ] Export always matches sequence dimensions

### Multi-Clip Behavior

- [ ] Add clips with different aspect ratios
- [ ] Program monitor stays stable
- [ ] All clips visible in sequence space
- [ ] No unexpected resizing

## References

### Professional NLE Documentation

**Adobe Premiere Pro:**

- Sequence Settings: Resolution, frame rate, pixel aspect ratio
- "Set to Frame Size" vs "Scale to Frame Size"
- Nested sequences

**DaVinci Resolve:**

- Project Settings → Timeline Format
- Timeline Resolution vs Output Resolution
- Smart Reframe (AI crop for different aspects)

**Final Cut Pro:**

- Project Properties
- Spatial Conform
- Custom aspect ratios

### Industry Standards

- **Broadcast**: 1920x1080 (16:9)
- **Cinema**: 2048x1080 (DCI 2K), 4096x2160 (DCI 4K)
- **Social Media**: 1080x1920 (9:16 portrait)
- **Square**: 1080x1080 (1:1)

## Conclusion

Sequence space is the **coordinate universe** for professional video editing. It:

- ✅ Stays fixed regardless of clips
- ✅ Defines the render output
- ✅ Provides stable compositing space
- ✅ Matches professional NLE behavior

Clips are **guests** in sequence space. They transform to fit, but the sequence itself never changes based on its contents.

This architectural principle enables:

- Predictable compositing
- Stable motion graphics
- Reliable transitions
- Consistent export
- Professional workflows

The "Original" preview mode now correctly shows the **sequence aspect ratio**, not the source media aspect ratio, matching industry standards.
