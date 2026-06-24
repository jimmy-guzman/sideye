import { RGBA } from "@opentui/core";

import { darkTheme } from "./dark";
import { lightTheme } from "./light";
import type { Theme } from "./tokens";

// Call sites that paint line colors need RGBA objects; resolving once per
// Theme keeps them stable singletons, so identity checks against
// Rgba.transparent keep working and renders never re-convert
export interface ResolvedTheme {
  colors: Theme;
  // "...Active" variants are the diff/diagnostic backgrounds brightened for the
  // Current (cursor) line, so a selected add/remove/diagnostic line reads as a
  // Brighter version of its own state instead of being flattened to grey.
  rgba: {
    addedBg: RGBA;
    addedBgActive: RGBA;
    addedLineNumberBgActive: RGBA;
    cursorBg: RGBA;
    errorGutterBg: RGBA;
    findMatchBg: RGBA;
    findMatchBgActive: RGBA;
    infoGutterBg: RGBA;
    removedBg: RGBA;
    removedBgActive: RGBA;
    removedLineNumberBgActive: RGBA;
    transparent: RGBA;
    warningGutterBg: RGBA;
  };
}

// Multiplicative RGB scale: lifts lightness while preserving hue (channel ratios),
// So a dark red stays red as it brightens rather than washing toward neutral grey.
function scaleRgba(hex: string, factor: number) {
  const base = RGBA.fromHex(hex);
  const lift = (channel: number) => Math.min(1, channel * factor);
  return RGBA.fromValues(lift(base.r), lift(base.g), lift(base.b), base.a);
}

const ACTIVE_FACTOR = 1.6;

export function resolveTheme(theme: Theme): ResolvedTheme {
  const active = (hex: string) => scaleRgba(hex, ACTIVE_FACTOR);
  return {
    colors: theme,
    rgba: {
      addedBg: RGBA.fromHex(theme.diff.addedBg),
      addedBgActive: active(theme.diff.addedBg),
      addedLineNumberBgActive: active(theme.diff.addedLineNumberBg),
      cursorBg: RGBA.fromHex(theme.surface.cursor),
      errorGutterBg: RGBA.fromHex(theme.severity.errorGutterBg),
      findMatchBg: RGBA.fromHex(theme.find.matchBg),
      findMatchBgActive: active(theme.find.matchBg),
      infoGutterBg: RGBA.fromHex(theme.severity.infoGutterBg),
      removedBg: RGBA.fromHex(theme.diff.removedBg),
      removedBgActive: active(theme.diff.removedBg),
      removedLineNumberBgActive: active(theme.diff.removedLineNumberBg),
      transparent: RGBA.fromValues(0, 0, 0, 0),
      warningGutterBg: RGBA.fromHex(theme.severity.warningGutterBg),
    },
  };
}

/**
 * Resolves a theme mode to its token set. The seam for a future runtime switch
 * (renderer.waitForThemeMode / THEME_MODE event); today the mode is fixed in `theme/mode.ts`.
 */
export function themeForMode(mode: "dark" | "light"): Theme {
  return mode === "light" ? lightTheme : darkTheme;
}
