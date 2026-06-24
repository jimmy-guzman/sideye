import { describe, expect, test } from "bun:test";

import { RGBA } from "@opentui/core";

import { darkTheme } from "../src/theme/dark";
import { lightTheme } from "../src/theme/light";
import { resolveTheme } from "../src/theme/resolve";

const HEX = /^#[0-9a-f]{6}$/;

// Walks the theme and collects every string leaf; syntax style objects mix
// Booleans (bold/italic/…) with color strings, and only the strings matter here
function collectColors(value: unknown, path: string, out: [path: string, color: string][]) {
  if (typeof value === "string") {
    out.push([path, value]);
    return;
  }

  if (typeof value === "object" && value !== null) {
    for (const [key, child] of Object.entries(value)) {
      collectColors(child, `${path}.${key}`, out);
    }
  }
}

describe.each([
  ["darkTheme", darkTheme],
  ["lightTheme", lightTheme],
])("%s", (_name, theme) => {
  test("every color token is a lowercase 6-digit hex", () => {
    const colors: [path: string, color: string][] = [];
    collectColors(theme, "theme", colors);

    expect(colors.length).toBeGreaterThan(0);
    expect(colors.filter(([, color]) => !HEX.test(color))).toEqual([]);
  });
});

describe("theme parity", () => {
  test("light and dark expose the exact same token paths", () => {
    const paths = (theme: unknown) => {
      const out: [path: string, color: string][] = [];
      collectColors(theme, "theme", out);
      return out.map(([path]) => path).toSorted();
    };

    expect(paths(lightTheme)).toEqual(paths(darkTheme));
  });
});

describe("resolveTheme", () => {
  test("transparent is the zero RGBA singleton", () => {
    const resolved = resolveTheme(darkTheme);

    expect(resolved.colors).toBe(darkTheme);
    expect(resolved.rgba.transparent).toEqual(RGBA.fromValues(0, 0, 0, 0));
  });

  test("active variants brighten their base diff token without overflowing", () => {
    const resolved = resolveTheme(darkTheme);
    const base = RGBA.fromHex(darkTheme.diff.removedBg);

    // The dominant (red) channel lifts above the base and stays clamped to 1.
    expect(resolved.rgba.removedBgActive.r).toBeGreaterThan(base.r);
    expect(resolved.rgba.removedBgActive.r).toBeLessThanOrEqual(1);
  });
});
