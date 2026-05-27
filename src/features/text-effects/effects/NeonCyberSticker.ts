export interface NeonCyberStickerConfig {
  width: number;
  height: number;
  text: string;
  fontFamily?: string;
  fontWeight?: number;
  fontStyle?: "normal" | "italic";
  fontSize?: number;
  letterSpacing?: number;
  lineHeight?: number;
  fillType?: "solid" | "linear" | "radial" | "none";
  fillColor?: string;
  fillGradientAngle?: number;
  fillGradientStops?: Array<{ color: string; offset: number }>;
  strokeEnabled?: boolean;
  strokeColor?: string;
  strokeWidth?: number;
  strokePosition?: "outside" | "center" | "inside";
  strokeOpacity?: number;
  strokeLineJoin?: "round" | "miter" | "bevel";
  shadowEnabled?: boolean;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowOpacity?: number;
  shadowType?: "drop" | "inner";
  bevelEnabled?: boolean;
  bevelDepth?: number;
  bevelHighlight?: string;
  bevelShadow?: string;
  bevelDirection?: "bottom-right" | "bottom" | "right";
  panelEnabled?: boolean;
  panelColor?: string;
  panelOpacity?: number;
  panelRadius?: number;
  panelPaddingX?: number;
  panelPaddingY?: number;
  panelStrokeEnabled?: boolean;
  panelStrokeColor?: string;
  panelStrokeWidth?: number;
  textPosX?: "left" | "center" | "right";
  textPosY?: "top" | "middle" | "bottom";
  glowLayers?: Array<{
    enabled: boolean;
    color: string;
    blur: number;
    opacity: number;
    type: "outer" | "inner";
    strength?: number;
    spread?: number;
  }>;
}

export class NeonCyberStickerEngine {
  private cfg: Required<NeonCyberStickerConfig>;

  constructor(config: NeonCyberStickerConfig) {
    // Merge provided configuration with static studio defaults
    const defaults: Required<NeonCyberStickerConfig> = {
      width: 800,
      height: 200,
      text: "Classic Ink",
      fontFamily: "Impact",
      fontWeight: 900,
      fontStyle: "normal",
      fontSize: 85,
      letterSpacing: 3,
      lineHeight: 1.1,
      fillType: "linear",
      fillColor: "#FFD200",
      fillGradientAngle: 90,
      fillGradientStops: [
        {
          color: "#FFE600",
          offset: 0,
        },
        {
          color: "#FF6C00",
          offset: 60,
        },
        {
          color: "#FF0055",
          offset: 100,
        },
      ],
      strokeEnabled: true,
      strokeColor: "#FFFFFF",
      strokeWidth: 12,
      strokePosition: "outside",
      strokeOpacity: 100,
      strokeLineJoin: "round",
      shadowEnabled: true,
      shadowColor: "#080114",
      shadowBlur: 15,
      shadowOffsetX: 8,
      shadowOffsetY: 10,
      shadowOpacity: 90,
      shadowType: "drop",
      bevelEnabled: true,
      bevelDepth: 5,
      bevelHighlight: "#FFFFFF",
      bevelShadow: "#990033",
      bevelDirection: "bottom-right",
      panelEnabled: false,
      panelColor: "#0B0318",
      panelOpacity: 85,
      panelRadius: 24,
      panelPaddingX: 45,
      panelPaddingY: 22,
      panelStrokeEnabled: true,
      panelStrokeColor: "#31115C",
      panelStrokeWidth: 4,
      textPosX: "center",
      textPosY: "middle",
      glowLayers: [
        {
          enabled: true,
          color: "#B800FF",
          blur: 12,
          opacity: 100,
          type: "outer",
        },
        {
          enabled: true,
          color: "#00FFFF",
          blur: 35,
          opacity: 85,
          type: "outer",
        },
      ],
    };

    this.cfg = {
      ...defaults,
      ...config,
    };
  }

  // Satisfies standard Clypra text engine contract - For animated text effects, increments dynamic timelines
  advanceSteps(steps: number): void {
    // This effect is static and has a no-op implementation
  }

  drawFrame(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, ghostFrames?: ImageData[]): void {
    const { width, height, text, fontFamily, fontWeight, fontStyle, fontSize, letterSpacing, lineHeight, fillType, fillColor, fillGradientAngle, fillGradientStops, strokeEnabled, strokeColor, strokeWidth, strokePosition, strokeOpacity, strokeLineJoin, shadowEnabled, shadowColor, shadowBlur, shadowOffsetX, shadowOffsetY, shadowOpacity, shadowType, bevelEnabled, bevelDepth, bevelHighlight, bevelShadow, bevelDirection, panelEnabled, panelColor, panelOpacity, panelRadius, panelPaddingX, panelPaddingY, panelStrokeEnabled, panelStrokeColor, panelStrokeWidth, textPosX, textPosY } = this.cfg;

    // Clear dynamic context canvas - Absolutely no color bleed background fills allowed
    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = true;

    // Set text font properties
    const fontStr = `${fontStyle} ${fontWeight} ${fontSize}px "${fontFamily}"`;
    ctx.font = fontStr;
    ctx.lineJoin = strokeLineJoin;

    const lines = text.split("\n");
    const numLines = lines.length;
    const textBlockHeight = fontSize + (numLines - 1) * fontSize * lineHeight;

    // Determine horizontal origins
    let startX = width / 2;
    let align: CanvasTextAlign = "center";
    if (textPosX === "left") {
      startX = panelEnabled ? panelPaddingX + 20 : 50;
      align = "left";
    } else if (textPosX === "right") {
      startX = width - (panelEnabled ? panelPaddingX + 20 : 50);
      align = "right";
    }
    ctx.textAlign = align;

    // Vertical alignment origins
    let startY = (height - textBlockHeight) / 2 + fontSize * 0.8;
    if (textPosY === "top") {
      startY = (panelEnabled ? panelPaddingY + 20 : 40) + fontSize * 0.8;
    } else if (textPosY === "bottom") {
      startY = height - (panelEnabled ? panelPaddingY + 20 : 40) - textBlockHeight + fontSize * 0.8;
    }

    // Dynamic measurements
    let maxLineWidth = 0;
    const lineWidths = lines.map((line) => {
      const originalSpacing = (ctx as any).letterSpacing || "normal";
      if (letterSpacing !== 0) {
        (ctx as any).letterSpacing = `${letterSpacing}px`;
      }
      const w = ctx.measureText(line).width;
      (ctx as any).letterSpacing = originalSpacing;
      return w;
    });
    maxLineWidth = Math.max(...lineWidths, 10);

    let xMin = startX;
    if (align === "center") {
      xMin = startX - maxLineWidth / 2;
    } else if (align === "right") {
      xMin = startX - maxLineWidth;
    }
    const xMax = xMin + maxLineWidth;
    const yMin = startY - fontSize * 0.8;
    const yMax = yMin + textBlockHeight;

    // Internal line drawer
    const renderLines = (mode: "fill" | "stroke", overrideStyle?: string | CanvasGradient, offsetX = 0, offsetY = 0) => {
      const savedLetterSpacing = (ctx as any).letterSpacing || "normal";
      if (letterSpacing !== 0) {
        (ctx as any).letterSpacing = `${letterSpacing}px`;
      }

      if (overrideStyle) {
        if (mode === "fill") {
          ctx.fillStyle = overrideStyle;
        } else {
          ctx.strokeStyle = overrideStyle;
        }
      }

      lines.forEach((line, index) => {
        const py = startY + index * fontSize * lineHeight;
        if (mode === "fill") {
          ctx.fillText(line, startX + offsetX, py + offsetY);
        } else {
          ctx.strokeText(line, startX + offsetX, py + offsetY);
        }
      });

      (ctx as any).letterSpacing = savedLetterSpacing;
    };

    // Offscreen offset shadow renderer helper (keeps shadow crisp & avoids source text overlapping)
    const renderWithShadowTrick = (mode: "fill" | "stroke", sColor: string, sBlur: number, sOffsetX: number, sOffsetY: number, opacity: number, overrideStyle = "#000", spread = 0) => {
      ctx.save();
      ctx.globalAlpha = opacity / 100;

      const shiftX = 10000;
      ctx.shadowColor = sColor;
      ctx.shadowBlur = sBlur;
      ctx.shadowOffsetX = shiftX + sOffsetX;
      ctx.shadowOffsetY = sOffsetY;

      const savedLetterSpacing = (ctx as any).letterSpacing || "normal";
      if (letterSpacing !== 0) {
        (ctx as any).letterSpacing = `${letterSpacing}px`;
      }

      const prevStyle = mode === "fill" ? ctx.fillStyle : ctx.strokeStyle;
      if (mode === "fill") {
        ctx.fillStyle = overrideStyle;
      } else {
        ctx.strokeStyle = overrideStyle;
      }

      const prevStrokeStyle = ctx.strokeStyle;
      const prevLineWidth = ctx.lineWidth;
      if (spread > 0) {
        ctx.strokeStyle = overrideStyle;
        ctx.lineWidth = spread * 2;
        ctx.lineJoin = strokeLineJoin;
      }

      lines.forEach((line, index) => {
        const py = startY + index * fontSize * lineHeight;
        if (mode === "fill") {
          if (spread > 0) {
            ctx.strokeText(line, startX - shiftX, py);
          }
          ctx.fillText(line, startX - shiftX, py);
        } else {
          ctx.strokeText(line, startX - shiftX, py);
        }
      });

      (ctx as any).letterSpacing = savedLetterSpacing;
      if (mode === "fill") {
        ctx.fillStyle = prevStyle;
      } else {
        ctx.strokeStyle = prevStyle;
      }
      if (spread > 0) {
        ctx.strokeStyle = prevStrokeStyle;
        ctx.lineWidth = prevLineWidth;
      }

      ctx.restore();
    };

    // 1. Background Panel (If active)
    if (panelEnabled) {
      ctx.save();
      ctx.globalAlpha = panelOpacity / 100;
      ctx.fillStyle = panelColor;

      const px = xMin - panelPaddingX;
      const py = yMin - panelPaddingY;
      const pw = xMax - xMin + 2 * panelPaddingX;
      const ph = textBlockHeight + 2 * panelPaddingY;

      ctx.beginPath();
      ctx.roundRect(px, py, pw, ph, panelRadius);
      ctx.fill();

      if (panelStrokeEnabled) {
        ctx.strokeStyle = panelStrokeColor;
        ctx.lineWidth = panelStrokeWidth;
        ctx.stroke();
      }
      ctx.restore();
    }

    // 2. Glow Layers (Type: Outer)
    const glowLayers = this.cfg.glowLayers || [];
    glowLayers.forEach((layer) => {
      if (layer.enabled && layer.type === "outer" && layer.opacity > 0) {
        const renderCount = Math.max(1, Math.min(20, layer.strength ?? 1));
        for (let i = 0; i < renderCount; i++) {
          renderWithShadowTrick("fill", layer.color, layer.blur, 0, 0, layer.opacity, "#000", layer.spread ?? 0);
        }
      }
    });

    // 3. Drop Shadow (Type: Drop)
    if (shadowEnabled && shadowType === "drop" && shadowOpacity > 0) {
      renderWithShadowTrick("fill", shadowColor, shadowBlur, shadowOffsetX, shadowOffsetY, shadowOpacity);
    }

    // 4. Glitch RGB Splitting simulation (if applicable)
    const isGlitchEffect = "NeonCyberSticker".toLowerCase().includes("glitch") || text === "SYSTEM ERR";
    if (isGlitchEffect) {
      ctx.save();
      ctx.globalAlpha = 0.8;
      renderLines("fill", "#00FFFF", -4, -2);
      renderLines("fill", "#FF00FF", 4, 2);
      ctx.restore();
    }

    // 5. Bevel 3D Layers
    if (bevelEnabled && bevelDepth > 0) {
      ctx.save();
      for (let i = bevelDepth; i > 0; i--) {
        let dx = 0;
        let dy = 0;
        if (bevelDirection === "bottom-right") {
          dx = i;
          dy = i;
        } else if (bevelDirection === "bottom") {
          dy = i;
        } else if (bevelDirection === "right") {
          dx = i;
        }
        const sliceColor = i === 1 ? bevelHighlight : bevelShadow;
        renderLines("fill", sliceColor, dx, dy);
      }
      ctx.restore();
    }

    // 6. Stroke Center or Outside
    if (strokeEnabled && strokeWidth > 0 && strokePosition !== "inside") {
      ctx.save();
      ctx.globalAlpha = strokeOpacity / 100;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokePosition === "outside" ? strokeWidth * 2 : strokeWidth;
      renderLines("stroke");
      ctx.restore();
    }

    // 7. Base Fill Setup (Solid or gradients)
    ctx.save();
    let computedFill: string | CanvasGradient = fillColor;

    if (fillType === "linear" && fillGradientStops.length >= 2) {
      const angleRad = (fillGradientAngle * Math.PI) / 180;
      const cx = (xMin + xMax) / 2;
      const cy = (yMin + yMax) / 2;
      const r = Math.max(xMax - xMin, yMax - yMin) / 2;

      const x0 = cx - Math.cos(angleRad) * r;
      const y0 = cy - Math.sin(angleRad) * r;
      const x1 = cx + Math.cos(angleRad) * r;
      const y1 = cy + Math.sin(angleRad) * r;

      const grad = ctx.createLinearGradient(x0, y0, x1, y1);
      fillGradientStops.forEach((stop) => {
        grad.addColorStop(stop.offset / 100, stop.color);
      });
      computedFill = grad;
    } else if (fillType === "radial" && fillGradientStops.length >= 2) {
      const cx = (xMin + xMax) / 2;
      const cy = (yMin + yMax) / 2;
      const r = Math.max(xMax - xMin, yMax - yMin) / 1.5;

      const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
      fillGradientStops.forEach((stop) => {
        grad.addColorStop(stop.offset / 100, stop.color);
      });
      computedFill = grad;
    }

    if (fillType !== "none") {
      renderLines("fill", computedFill);
    }
    ctx.restore();

    // Inside stroke clipping composition fallback
    if (strokeEnabled && strokeWidth > 0 && strokePosition === "inside") {
      ctx.save();
      ctx.globalCompositeOperation = "source-atop";
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth * 2;
      ctx.globalAlpha = strokeOpacity / 100;
      renderLines("stroke");
      ctx.restore();
    }

    // 8. Glow and Shadow overlays on top (using source-atop composition)
    glowLayers.forEach((layer) => {
      if (layer.enabled && layer.type === "inner" && layer.opacity > 0) {
        ctx.save();
        ctx.globalCompositeOperation = "source-atop";
        const renderCount = Math.max(1, Math.min(20, layer.strength ?? 1));
        for (let i = 0; i < renderCount; i++) {
          renderWithShadowTrick("fill", layer.color, layer.blur, 0, 0, layer.opacity, "transparent", layer.spread ?? 0);
        }
        ctx.restore();
      }
    });

    if (shadowEnabled && shadowType === "inner" && shadowOpacity > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "source-atop";
      renderWithShadowTrick("fill", shadowColor, shadowBlur, shadowOffsetX, shadowOffsetY, shadowOpacity, "transparent");
      ctx.restore();
    }

    // 9. Extra scanline grid (Glitch only)
    if (isGlitchEffect) {
      ctx.save();
      ctx.globalCompositeOperation = "source-atop";
      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      ctx.lineWidth = 1.5;
      for (let ly = yMin; ly < yMax; ly += 4) {
        ctx.beginPath();
        ctx.moveTo(xMin - 50, ly);
        ctx.lineTo(xMax + 50, ly);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

export const NeonCyberStickerDefinition = {
  id: "neon-cyber-sticker",
  name: "Neon Cyber Sticker",
  category: "classic",
  description: "A custom Canvas 2D text effect named Neon Cyber Sticker with linear fill.",
  tags: ["studio-export", "custom-canvas", "linear"],
  font: {
    family: "Impact",
    weight: 900,
    style: "normal",
    letterSpacing: 3,
    lineHeight: 1.1,
  },
  fills: [
    {
      type: "linear",
      color: "#FFD200",
      gradient: {
        angle: 90,
        stops: [
          {
            color: "#FFE600",
            offset: 0,
          },
          {
            color: "#FF6C00",
            offset: 60,
          },
          {
            color: "#FF0055",
            offset: 100,
          },
        ],
      },
    },
  ],
  strokes: [
    {
      color: "#FFFFFF",
      width: 12,
      position: "outside",
      opacity: 100,
      lineJoin: "round",
    },
  ],
  shadows: [
    {
      type: "drop",
      color: "#080114",
      blur: 15,
      offset: {
        x: 8,
        y: 10,
      },
      opacity: 90,
    },
  ],
  glows: [
    {
      color: "#B800FF",
      blur: 12,
      opacity: 100,
      type: "outer",
    },
    {
      color: "#00FFFF",
      blur: 35,
      opacity: 85,
      type: "outer",
    },
  ],
  panel: null,
} as any;
