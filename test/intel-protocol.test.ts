import { expect, test } from "bun:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { normalizeDefinition, normalizeHover, normalizeReferences } from "@/intel/protocol";

const uri = pathToFileURL("/repo/src/target.ts").href;
const path = fileURLToPath(uri);
const range = { end: { character: 9, line: 4 }, start: { character: 2, line: 4 } };

test("normalizeDefinition returns empty for null", () => {
  expect(normalizeDefinition(null)).toEqual([]);
});

test("normalizeDefinition maps a single Location to 1-based path:line:col", () => {
  expect(normalizeDefinition({ range, uri })).toEqual([{ column: 3, line: 5, path }]);
});

test("normalizeDefinition maps a Location array", () => {
  const other = {
    range: { end: { character: 1, line: 0 }, start: { character: 0, line: 0 } },
    uri,
  };
  expect(normalizeDefinition([{ range, uri }, other])).toEqual([
    { column: 3, line: 5, path },
    { column: 1, line: 1, path },
  ]);
});

test("normalizeDefinition prefers a LocationLink's targetSelectionRange over targetRange", () => {
  const link = {
    targetRange: { end: { character: 0, line: 10 }, start: { character: 0, line: 3 } },
    targetSelectionRange: range,
    targetUri: uri,
  };
  expect(normalizeDefinition([link])).toEqual([{ column: 3, line: 5, path }]);
});

test("normalizeDefinition falls back to a LocationLink's targetRange", () => {
  const link = { targetRange: range, targetUri: uri };
  expect(normalizeDefinition([link])).toEqual([{ column: 3, line: 5, path }]);
});

test("normalizeDefinition drops malformed items", () => {
  expect(normalizeDefinition([{ range, uri }, { nope: true }, null])).toEqual([
    { column: 3, line: 5, path },
  ]);
});

test("normalizeDefinition drops a LocationLink with a present-but-malformed targetSelectionRange", () => {
  // A non-nullish, non-range selection range must not reach the `.start` read; skip the link.
  const link = { targetRange: range, targetSelectionRange: 42, targetUri: uri };
  expect(normalizeDefinition([link, { range, uri }])).toEqual([{ column: 3, line: 5, path }]);
});

test("normalizeDefinition skips non-file URIs instead of throwing", () => {
  const untitled = { range, uri: "untitled:Untitled-1" };
  expect(normalizeDefinition([untitled, { range, uri }])).toEqual([{ column: 3, line: 5, path }]);
  expect(normalizeDefinition(untitled)).toEqual([]);
});

test("normalizeReferences maps a Location array and ignores a non-array reply", () => {
  expect(normalizeReferences([{ range, uri }])).toEqual([{ column: 3, line: 5, path }]);
  expect(normalizeReferences(null)).toEqual([]);
  expect(normalizeReferences({ range, uri })).toEqual([]);
});

test("normalizeHover returns empty for a null reply", () => {
  expect(normalizeHover(null)).toBe("");
});

test("normalizeHover reads a MarkupContent value", () => {
  expect(normalizeHover({ contents: { kind: "plaintext", value: "const alpha: number" } })).toBe(
    "const alpha: number",
  );
});

test("normalizeHover reads a bare MarkedString", () => {
  expect(normalizeHover({ contents: "a doc string" })).toBe("a doc string");
});

test("normalizeHover reads a MarkedString code segment's value", () => {
  expect(
    normalizeHover({ contents: { language: "typescript", value: "function f(): void" } }),
  ).toBe("function f(): void");
});

test("normalizeHover joins a MarkedString array and skips empty segments", () => {
  expect(
    normalizeHover({
      contents: [{ language: "typescript", value: "const a: 1" }, "", "Docs here."],
    }),
  ).toBe("const a: 1\n\nDocs here.");
});

test("normalizeHover strips markdown code fences and collapses the blank runs", () => {
  const markdown = "```typescript\nconst alpha: number\n```\n\n\nA constant.";
  expect(normalizeHover({ contents: { kind: "markdown", value: markdown } })).toBe(
    "const alpha: number\n\nA constant.",
  );
});
