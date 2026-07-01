/**
 * Attach a source-line preview to each reference location, so the results overlay can show
 * `path:line:col` alongside the line it points at. Pure (no Effect/Solid), so it unit-tests like
 * `intel/protocol.ts`; the caller reads each file's text and hands over a path-keyed map of its
 * lines.
 */
import type { NormalizedLocation } from "./protocol";

export interface ReferenceResult extends NormalizedLocation {
  /** The referenced source line, leading whitespace trimmed; empty when unavailable. */
  text: string;
}

// A location whose file was unreadable (absent from `linesByPath`) or whose 1-based line
// Is out of range still gets a row, just with an empty preview, rather than being dropped.
function previewLine(lines: string[] | undefined, line: number): string {
  return lines?.[line - 1]?.trimStart() ?? "";
}

export function attachReferencePreviews(
  locations: NormalizedLocation[],
  linesByPath: Map<string, string[]>,
): ReferenceResult[] {
  return locations.map((location) => ({
    ...location,
    text: previewLine(linesByPath.get(location.path), location.line),
  }));
}
