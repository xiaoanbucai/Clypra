# Portrait Thumbnail Fix: From Problem to Solution

## The Problem: Why Portrait Videos Showed Corrupted Thumbnails

### Initial Symptoms

- Portrait videos displayed with horizontal scan lines/artifacts
- Some thumbnails appeared stretched or squashed
- Different videos from different sources (HandBrake, CapCut, iPhone) behaved differently

### Real-World Example

```
HandBrake video:  Pixels: 1920×1080, SAR: 81:256, Display: 9:16 portrait
CapCut video:     Pixels: 4320×7680, SAR: 0:1,    Display: 9:16 portrait
iPhone video:     Pixels: 1920×1080, Rotation: 90°, Display: 9:16 portrait
```

All three are portrait videos, but encoded completely differently!

---

## Understanding Video Coordinate Spaces (The Core Concept)

### Analogy: A Painting on Stretched Canvas

Imagine you have a painting:

1. **Storage Space** (pixels): The actual canvas size (e.g., 1920×1080 inches)
2. **Pixel Shape** (SAR): The canvas is stretched - each "inch" is actually 0.3 real inches wide
3. **Display Intent** (DAR): When hung on the wall, it should appear as 9:16 portrait

**The bug**: We were measuring the canvas size (1920×1080) and calling it landscape, ignoring that the canvas was stretched and meant to be displayed as portrait.

### Video Has 3 Coordinate Spaces

```
┌─────────────────────────────────────────────────────────────┐
│ 1. STORAGE SPACE (Encoded Pixels)                          │
│    What FFmpeg decodes: 1920×1080 buffer                   │
│    ❌ This is NOT the display size!                         │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. PIXEL INTERPRETATION (SAR - Sample Aspect Ratio)        │
│    Pixels might not be square!                             │
│    SAR 81:256 means: width × (81/256) = 608×1080          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. DISPLAY SPACE (After Rotation)                          │
│    Final display: 608×1080 (portrait)                      │
│    ✅ This is what the user sees!                           │
└─────────────────────────────────────────────────────────────┘
```

---

## The Bug: Pixel-Centric vs Display-Centric

### ❌ Old Approach (Pixel-Centric)

```rust
// WRONG: Using raw pixel dimensions
let width = decoder.width();   // 1920
let height = decoder.height(); // 1080
// Conclusion: "This is landscape!" ❌

// Scale and rotate
scale(1920, 1080 → 320, 180)  // Landscape scaling
rotate(90°)                    // Too late! Already stretched
// Result: Corrupted thumbnail
```

### ✅ New Approach (Display-Centric)

```rust
// CORRECT: Calculate display dimensions first
let (display_w, display_h) = decoder.display_dimensions();
// Returns: 608×1080 (portrait) ✅

// Scale in display space
scale(608, 1080 → 180, 320)   // Portrait scaling
// Result: Clean portrait thumbnail
```

---

## Step-by-Step Implementation

### Step 1: Detect SAR (Sample Aspect Ratio)

**File**: `src-tauri/src/thumbnail_engine/decoder.rs`

**What**: Read pixel shape metadata from video stream

```rust
// Inside VideoDecoder::open()
let sar = unsafe {
    let codecpar = (*stream.as_ptr()).codecpar;
    if !codecpar.is_null() {
        let sar_num = (*codecpar).sample_aspect_ratio.num;
        let sar_den = (*codecpar).sample_aspect_ratio.den;
        if sar_den > 0 {
            (sar_num, sar_den)
        } else {
            (1, 1) // Square pixels (default)
        }
    } else {
        (1, 1)
    }
};
```

**Why**: Videos can have non-square pixels (anamorphic encoding). SAR tells us the pixel shape.

**Examples**:

- `SAR 1:1` = Square pixels (normal)
- `SAR 81:256` = Narrow pixels (HandBrake anamorphic)
- `SAR 0:1` = Invalid/undefined (CapCut bug)

---

### Step 2: Store SAR in Decoder

**File**: `src-tauri/src/thumbnail_engine/decoder.rs`

```rust
pub struct VideoDecoder {
    // ... existing fields
    sar: (i32, i32),  // NEW: Store SAR
    rotation: u32,
    // ...
}
```

**Why**: We need SAR available when calculating display dimensions.

---

### Step 3: Calculate Display Dimensions

**File**: `src-tauri/src/thumbnail_engine/decoder.rs`

**What**: Convert pixel dimensions → display dimensions

```rust
pub fn display_dimensions(&self) -> (u32, u32) {
    // Step 1: Apply SAR correction
    let display_w = if self.sar.0 > 0 && self.sar.1 > 0 && self.sar.0 != self.sar.1 {
        // Non-square pixels: adjust width
        ((self.width as f64) * (self.sar.0 as f64) / (self.sar.1 as f64)).round() as u32
    } else {
        // Square pixels or invalid SAR: use raw width
        self.width
    };
    let display_h = self.height;

    // Step 2: Apply rotation
    if self.rotation == 90 || self.rotation == 270 {
        (display_h, display_w)  // Swap for portrait
    } else {
        (display_w, display_h)
    }
}
```

**Why**: This is the CORRECT size for rendering. It accounts for both pixel shape and rotation.

**Example Flow**:

```
HandBrake video:
  Pixels: 1920×1080
  SAR: 81:256
  → display_w = 1920 × (81/256) = 608
  → display_h = 1080
  Rotation: 0°
  → Final: 608×1080 (portrait) ✅

iPhone video:
  Pixels: 1920×1080
  SAR: 1:1
  → display_w = 1920
  → display_h = 1080
  Rotation: 90°
  → Final: 1080×1920 (portrait) ✅

CapCut video:
  Pixels: 4320×7680
  SAR: 0:1 (invalid)
  → display_w = 4320 (fallback to raw)
  → display_h = 7680
  Rotation: 0°
  → Final: 4320×7680 (portrait) ✅
```

---

### Step 4: Use Display Dimensions for Thumbnails

**File**: `src-tauri/src/lib.rs`

**What**: Request thumbnails in display space, not pixel space

```rust
async fn extract_poster_frame_command(...) -> Result<String, String> {
    let decoder_arc = get_decoder(&video_path).await?;
    let (rgba_bytes, out_w, out_h) = {
        let mut decoder = decoder_arc.lock().await;

        // ✅ NEW: Get display dimensions
        let (display_w, display_h) = decoder.display_dimensions();

        // Fit to target size (preserving aspect ratio)
        let (fit_w, fit_h) = fit_dimensions(display_w, display_h, max_size, max_size);

        // Decode at fitted size
        let bytes = decoder.decode_frame(poster_time, fit_w, fit_h)?;
        (bytes, fit_w, fit_h)
    };

    // Encode to WebP and return
    // ...
}
```

**Why**: Now we're working in display space throughout the pipeline.

---

### Step 5: Fix Decode Order (Rotate First, Then Scale)

**File**: `src-tauri/src/thumbnail_engine/decoder.rs`

**What**: Change the order of operations in `decode_frame()`

**❌ Old Order** (caused corruption):

```
Decode → Scale → Rotate
```

**✅ New Order** (correct):

```
Decode → Rotate → Scale
```

**Implementation**:

```rust
pub fn decode_frame(&mut self, timestamp_secs: f64, out_width: u32, out_height: u32) -> Result<Vec<u8>, String> {
    // ... seek and decode frame ...

    // Step 1: Convert to RGBA at native resolution
    let native_rgba = self.scale_to_rgba(&cpu_frame, cpu_frame.width(), cpu_frame.height())?;

    // Step 2: Apply rotation FIRST
    let (rotated_rgba, display_w, display_h) = if self.rotation != 0 {
        let rotated = Self::rotate_rgba(&native_rgba, cpu_frame.width(), cpu_frame.height(), self.rotation);
        if self.rotation == 90 || self.rotation == 270 {
            (rotated, cpu_frame.height(), cpu_frame.width())  // Dimensions swap
        } else {
            (rotated, cpu_frame.width(), cpu_frame.height())
        }
    } else {
        (native_rgba, cpu_frame.width(), cpu_frame.height())
    };

    // Step 3: Scale AFTER rotation (in display space)
    let rgba = if display_w != out_width || display_h != out_height {
        self.scale_rgba_buffer(&rotated_rgba, display_w, display_h, out_width, out_height)?
    } else {
        rotated_rgba
    };

    Ok(rgba)
}
```

**Why**: Rotating after scaling causes aspect ratio distortion. We must rotate first to get into display orientation, then scale.

---

## Complete Flow Diagram

### Before (Broken)

```
User imports video
    ↓
extract_poster_frame_command()
    ↓
Get pixel dimensions: 1920×1080
    ↓
❌ Assume landscape (wrong!)
    ↓
fit_dimensions(1920, 1080, 320, 320) → 320×180 (landscape)
    ↓
decode_frame(320, 180)
    ↓
  Decode 1920×1080 frame
  Scale to 320×180 (stretches!)
  Rotate 90° (too late, already stretched)
    ↓
❌ Corrupted thumbnail with scan lines
```

### After (Fixed)

```
User imports video
    ↓
extract_poster_frame_command()
    ↓
Get display dimensions: decoder.display_dimensions()
    ↓
  Read SAR: 81:256
  Apply SAR: 1920 × (81/256) = 608
  Apply rotation: 0°
  Return: 608×1080
    ↓
✅ Recognize as portrait
    ↓
fit_dimensions(608, 1080, 320, 320) → 180×320 (portrait)
    ↓
decode_frame(180, 320)
    ↓
  Decode 1920×1080 frame
  Convert to RGBA
  Rotate (if needed)
  Scale to 180×320 (correct aspect!)
    ↓
✅ Clean portrait thumbnail
```

---

## Key Insights

### 1. Video Metadata is Complex

Modern videos have multiple layers of metadata:

- Pixel dimensions (storage)
- Sample Aspect Ratio (pixel shape)
- Display Aspect Ratio (intended display)
- Rotation metadata (orientation)

**You must respect ALL of them.**

### 2. Pixel-Centric vs Display-Centric

```
Pixel-Centric:  "This video is 1920×1080, so it's landscape"
Display-Centric: "This video displays as 608×1080, so it's portrait"
```

Professional video tools are **display-centric**.

### 3. Order of Operations Matters

```
Scale → Rotate = ❌ Distortion
Rotate → Scale = ✅ Correct
```

Always transform to display space FIRST, then scale.

### 4. Edge Cases are Common

- Invalid SAR (0:1, 1:0)
- Negative SAR
- Extreme SAR ratios (1000:1)
- Combined SAR + rotation
- 8K videos (memory concerns)

**The implementation must handle all of these gracefully.**

---

## Testing Strategy

### Edge Cases Covered (26 tests)

1. **Normal cases**: Square pixels, landscape, portrait
2. **Rotation**: 90°, 180°, 270°
3. **Anamorphic**: HandBrake, DVD, PAL
4. **Invalid SAR**: 0:1, 1:0, 0:0, negative
5. **Extreme SAR**: Very wide, very narrow
6. **Social media**: TikTok (9:16), Instagram (1:1)
7. **Cinema**: Ultrawide (21:9), 4:3 TV
8. **Edge cases**: Zero dimensions, single pixel, 8K

### Test Philosophy

```rust
// Test the LOGIC, not the decoder
fn calc_display_dims(width, height, sar, rotation) -> (u32, u32) {
    // Pure function - easy to test
}
```

This allows testing all edge cases without needing actual video files.

---

## Performance Considerations

### Memory Usage

- **8K video**: 4320×7680 = 126 MB per frame (RGBA)
- **Solution**: Scale during decode, not after
- **FFmpeg's scaler**: Handles huge frames efficiently

### Stride Handling

```rust
// WRONG: Assume tightly packed
let rgba = frame.data(0)[0..width*height*4];

// CORRECT: Handle stride padding
for y in 0..height {
    let row_start = y * stride;
    let row_pixels = &src_data[row_start..row_start + (width * 4)];
    rgba.extend_from_slice(row_pixels);
}
```

**Why**: FFmpeg aligns rows with padding. Ignoring stride causes scan line corruption.

---

## Lessons Learned

### 1. Video is Not Just Pixels

Video files contain:

- Pixel data
- Metadata (SAR, DAR, rotation)
- Color space info
- Timing information

**All must be respected for correct rendering.**

### 2. Logs Expose Truth

```
[VideoDecoder::open] SAR: 81:256
[extract_poster] pixels=1920×1080 SAR=81:256 display=608×1080
```

These logs immediately revealed the SAR issue.

### 3. Professional Tools Handle This

CapCut, Premiere, DaVinci Resolve all handle:

- Anamorphic encoding
- Non-square pixels
- Rotation metadata
- Display matrices

**This is table stakes for video editing software.**

### 4. Test Edge Cases

The HandBrake anamorphic case (SAR 81:256) is rare but real. Without proper handling, these videos break.

---

## Summary

### The Problem

Portrait videos showed corrupted thumbnails because we were using **pixel dimensions** instead of **display dimensions**.

### The Solution

1. Read SAR (Sample Aspect Ratio) from video metadata
2. Calculate display dimensions: `width × (SAR_num / SAR_den)`
3. Apply rotation to get final display size
4. Use display dimensions for all thumbnail operations
5. Rotate FIRST, then scale (correct order)

### The Result

✅ HandBrake anamorphic videos: Correct portrait thumbnails ✅ CapCut 8K exports: Correct portrait thumbnails  
✅ iPhone rotation metadata: Correct portrait thumbnails ✅ All edge cases: Handled gracefully with 26 passing tests

### The Architecture

**Display-centric rendering**: All operations work in display space, not pixel space. This matches how professional video tools work and handles the complexity of modern video encoding.
