import type { Theme } from "@/theme/tokens";

export type LogLevel = "error" | "warning" | "success" | "info";

export function levelColor(colors: Theme, level: LogLevel) {
  return level === "error"
    ? colors.severity.error
    : level === "warning"
      ? colors.severity.warning
      : level === "success"
        ? colors.success
        : colors.text.secondary;
}

// Bare text-presentation codepoints, never the U+FE0F variation-selector form: a
// VS16 emoji renders two rows tall and strands the status row. These match the
// Glyphs the problems panel and tree rows already use (✖/⚠/ℹ severities, ✓ for
// Success), so the vocabulary stays consistent across every surface.
export function levelGlyph(level: LogLevel) {
  return level === "error" ? "✖" : level === "warning" ? "⚠" : level === "success" ? "✓" : "ℹ";
}
