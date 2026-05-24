import React from "react";

const getFontFamilyStack = (fontFamily: string) => {
  const f = fontFamily.toLowerCase();
  if (f.includes("outfit")) return '"Outfit", sans-serif';
  if (f.includes("poppins")) return '"Poppins", sans-serif';
  if (f.includes("roboto")) return '"Roboto", sans-serif';
  if (f.includes("inter")) return '"Inter Variable", sans-serif';
  return fontFamily;
};

export const TextSourcePreview: React.FC<{ preset: any }> = ({ preset }) => {
  if (!preset) return null;

  // Build dynamic CSS styles
  const baseStyle: React.CSSProperties = {
    fontFamily: getFontFamilyStack(preset.fontFamily),
    fontWeight: preset.fontWeight,
    fontStyle: preset.fontStyle,
  };

  const fillStyle: React.CSSProperties = {
    ...baseStyle,
  };

  // Solid or gradient color
  const color = preset.color || "#ffffff";
  if (color.includes(",")) {
    fillStyle.backgroundImage = `linear-gradient(to bottom, ${color})`;
    fillStyle.backgroundClip = "text";
    fillStyle.WebkitBackgroundClip = "text";
    fillStyle.color = "transparent";
  } else {
    fillStyle.color = color;
  }

  const hasStroke = !!preset.stroke;
  const strokeStyle: React.CSSProperties = {
    ...baseStyle,
    position: "absolute",
    color: "transparent",
    zIndex: 1,
  };

  if (preset.stroke) {
    strokeStyle.WebkitTextStroke = `${preset.stroke.width * 1.2}px ${preset.stroke.color}`; // slightly larger stroke for monitor size
  }

  if (preset.shadow) {
    if (hasStroke) {
      strokeStyle.textShadow = `${preset.shadow.offsetX * 1.2}px ${preset.shadow.offsetY * 1.2}px ${preset.shadow.blur * 1.2}px ${preset.shadow.color}`;
    } else {
      fillStyle.textShadow = `${preset.shadow.offsetX * 1.2}px ${preset.shadow.offsetY * 1.2}px ${preset.shadow.blur * 1.2}px ${preset.shadow.color}`;
    }
  }

  // Draw background box if specified
  const bgStyle: React.CSSProperties = preset.background
    ? {
        backgroundColor: preset.background.color,
        padding: `${preset.background.padding * 1.2}px`,
        borderRadius: `${preset.background.borderRadius * 1.2}px`,
      }
    : {};

  const previewText = preset.presetType === "template" ? preset.defaultText || "Text" : "Default text";

  return (
    <div className="w-full aspect-video bg-black flex items-center justify-center relative p-8 shadow-[0_0_40px_rgba(0,0,0,0.8)] border border-white/5 overflow-hidden">
      <div style={bgStyle} className="flex items-center justify-center relative select-none">
        {hasStroke && (
          <span style={strokeStyle} className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-center wrap-break-word select-none pointer-events-none">
            {previewText}
          </span>
        )}
        <span style={{ ...fillStyle, position: hasStroke ? "relative" : "static", zIndex: 2 }} className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-center wrap-break-word select-none">
          {previewText}
        </span>
      </div>
    </div>
  );
};
