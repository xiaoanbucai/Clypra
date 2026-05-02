# Settings System - Quick Guide

## 🎨 What's New

A complete settings system with customizable themes and fonts!

## 🚀 How to Use

### Opening Settings

1. Click the **Settings** icon (⚙️) in the TopBar (next to Export button)
2. Settings modal opens instantly

### Changing Theme

- **4 Beautiful Themes Available:**
  - 🌑 **Dark** - Classic dark theme (default)
  - 🌌 **Midnight** - Deep blue tones
  - 🌊 **Ocean** - Cool cyan accents
  - 🌲 **Forest** - Natural green hues

- Click any theme card to apply instantly
- Visual gradient preview shows theme colors
- Check icon (✓) shows current selection

### Changing Font

- **4 Font Options:**
  - 📝 **Inter** - Modern and clean (default)
  - 💻 **System** - Native system font
  - 🔤 **Monospace** - Code-style font
  - 📖 **Serif** - Classic and elegant

- Click any font option to apply instantly
- "Aa" preview shows font style
- Check icon (✓) shows current selection

## 💾 Persistence

- Settings automatically save to your browser
- Reopen the app → your settings are restored
- No need to reconfigure every time!

## 🎯 Key Features

✅ **Instant Preview** - See changes immediately ✅ **Persistent** - Settings saved automatically ✅ **Beautiful UI** - Custom designed modal ✅ **Accessible** - Keyboard navigation support ✅ **Extensible** - Easy to add more settings

## 📍 Location

**Settings Button:** TopBar → Right side → Between Undo/Redo and Export

```
[Home] [Project Name] | [Time] | [Undo] [Redo] | [⚙️ Settings] [Export]
                                                      ↑
                                                  Click here!
```

## 🎨 Theme Previews

### Dark (Default)

- Background: Deep black (#0f0f0f)
- Accent: Purple (#6c63ff)
- Best for: General use, low light

### Midnight

- Background: Navy blue (#0a0e1a)
- Accent: Bright blue (#5b8fff)
- Best for: Reduced eye strain, night work

### Ocean

- Background: Dark teal (#0a1520)
- Accent: Cyan (#00d4ff)
- Best for: Cool, calming atmosphere

### Forest

- Background: Dark green (#0d1410)
- Accent: Green (#4ade80)
- Best for: Natural, organic feel

## 🔤 Font Previews

### Inter (Default)

- Style: Sans-serif, modern
- Best for: UI, readability

### System

- Style: Native OS font
- Best for: Performance, native feel

### Monospace

- Style: Fixed-width, code-style
- Best for: Technical users, developers

### Serif

- Style: Traditional, elegant
- Best for: Classic look, long reading

## 🛠️ For Developers

### Import Settings Store

```typescript
import { useSettingsStore } from "../../store/settingsStore";

const { theme, fontFamily, setTheme, setFontFamily } = useSettingsStore();
```

### Programmatic Changes

```typescript
// Change theme
setTheme("ocean");

// Change font
setFontFamily("mono");

// Read current settings
console.log(theme); // "ocean"
console.log(fontFamily); // "mono"
```

### Add New Theme

See `SETTINGS_SYSTEM.md` for detailed instructions

## 📦 What's Included

### New Files

- `src/store/settingsStore.ts` - Settings state
- `src/components/ui/SettingsModal.tsx` - Settings UI
- `SETTINGS_SYSTEM.md` - Full documentation
- `SETTINGS_QUICK_GUIDE.md` - This guide

### Modified Files

- `src/store/uiStore.ts` - Added modal state
- `src/components/editor/TopBar.tsx` - Added button
- `src/components/screens/EditorScreen.tsx` - Integrated modal

## 🎉 Try It Now!

1. Open Clypra
2. Click Settings icon (⚙️) in TopBar
3. Try different themes - watch colors change!
4. Try different fonts - watch text change!
5. Close and reopen - settings persist!

Enjoy your personalized editing experience! 🚀
