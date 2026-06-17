import { describe, expect, it } from "vitest";
import { calculateTextClipSize, createTextClip } from "../text/textClip";
import type { TextEffectDefinition } from "@clypra/engine";

const inkGlowEffect = {
  id: "neon-crimson",
  name: "Neon Crimson",
  category: "built-in",
  description: "",
  tags: [],
  boundingBox: {
    mode: "ink",
    paddingX: 92,
    paddingY: 92,
  },
  font: {
    family: "Bebas Neue",
    weight: 400,
    style: "italic",
    letterSpacing: 8,
    lineHeight: 1.2,
  },
  fills: [{ type: "solid", color: "#ffffff" }],
  strokes: [],
  shadows: [],
  glows: [{ color: "#ff004c", blur: 80, opacity: 80, type: "outer" }],
} satisfies TextEffectDefinition;

const panelBannerEffect = {
  id: "boxed-title",
  name: "Boxed Title",
  category: "3d",
  description: "",
  tags: [],
  width: 800,
  height: 200,
  canvasWidth: 800,
  canvasHeight: 200,
  fontSize: 100,
  boundingBox: {
    mode: "panel",
    paddingX: 50,
    paddingY: 25,
  },
  font: {
    family: "Montserrat",
    weight: 900,
    style: "normal",
    letterSpacing: 8,
    lineHeight: 1.1,
  },
  fills: [{ type: "solid", color: "#ffffff" }],
  strokes: [],
  shadows: [],
  panel: {
    color: "#111111",
    opacity: 100,
    radius: 0,
    paddingX: 48,
    paddingY: 22,
    stroke: { color: "#ffffff", width: 2 },
  },
} satisfies TextEffectDefinition & { width: number; height: number; canvasWidth: number; canvasHeight: number; fontSize: number };

describe("calculateTextClipSize", () => {
  it("uses text effect typography when creating a style clip without explicit overrides", () => {
    const clip = createTextClip({
      trackId: "track-1",
      startTime: 0,
      duration: 3,
      text: "NEON",
      canvasWidth: 1920,
      canvasHeight: 1080,
      styleId: inkGlowEffect.id,
      effectDefinition: inkGlowEffect,
    });

    expect(clip.fontFamily).toBe("Bebas Neue");
    expect(clip.fontWeight).toBe(400);
    expect(clip.fontStyle).toBe("italic");
    expect(clip.lineHeight).toBe(1.2);
    expect(clip.letterSpacing).toBe(8);
    expect(clip.styleDefinition).toBe(inkGlowEffect);
  });

  it("does not put ink-effect render bleed into the editable text box height", () => {
    const sized = calculateTextClipSize({
      text: "CLYPRA",
      fontFamily: "Bebas Neue",
      fontSize: 100,
      styleId: "neon-crimson",
      effectDefinition: inkGlowEffect,
      canvasWidth: 1080,
    });

    expect(sized.bleed.y).toBe(92);
    expect(sized.height).toBeCloseTo(135);
    expect(sized.height).toBeLessThan(220);
  });

  it("reserves additional height when massive text wraps inside the canvas width cap", () => {
    const singleLine = calculateTextClipSize({
      text: "A",
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: 520,
      styleId: "neon-outline",
      effectDefinition: inkGlowEffect,
      canvasWidth: 640,
    });

    const wrapped = calculateTextClipSize({
      text: "CLYPRA",
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: 520,
      styleId: "neon-outline",
      effectDefinition: inkGlowEffect,
      canvasWidth: 640,
    });

    expect(wrapped.width).toBeLessThanOrEqual(640 * 0.95);
    expect(wrapped.height).toBeGreaterThan(singleLine.height * 1.5);
  });

  it("preserves native panel effect dimensions instead of collapsing to minimum width", () => {
    const clip = createTextClip({
      trackId: "track-1",
      startTime: 0,
      duration: 3,
      text: "MY TEXT",
      canvasWidth: 1080,
      canvasHeight: 1920,
      styleId: panelBannerEffect.id,
      effectDefinition: panelBannerEffect,
    });

    expect(clip.fontSize).toBe(100);
    expect(clip.width).toBeCloseTo(800);
    expect(clip.height).toBeCloseTo(200);
  });
});
