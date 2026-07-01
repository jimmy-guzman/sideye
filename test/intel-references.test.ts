import { expect, test } from "bun:test";

import { attachReferencePreviews } from "@/intel/references";

const loc = (path: string, line: number, column = 1) => ({ column, line, path });

test("attaches the 1-based source line, leading whitespace trimmed", () => {
  const lines = new Map([["src/a.ts", ["const a = 1", "  useA()", "return a"]]]);
  expect(attachReferencePreviews([loc("src/a.ts", 2)], lines)).toEqual([
    { column: 1, line: 2, path: "src/a.ts", text: "useA()" },
  ]);
});

test("keeps the row with an empty preview when the file is unreadable", () => {
  expect(attachReferencePreviews([loc("src/gone.ts", 3)], new Map())).toEqual([
    { column: 1, line: 3, path: "src/gone.ts", text: "" },
  ]);
});

test("keeps the row with an empty preview when the line is out of range", () => {
  const lines = new Map([["src/a.ts", ["only one line"]]]);
  expect(attachReferencePreviews([loc("src/a.ts", 5)], lines)).toEqual([
    { column: 1, line: 5, path: "src/a.ts", text: "" },
  ]);
});

test("previews several locations across files, preserving order", () => {
  const lines = new Map([
    ["src/a.ts", ["import { thing } from './b'", "thing()"]],
    ["src/b.ts", ["export const thing = 1"]],
  ]);
  expect(attachReferencePreviews([loc("src/a.ts", 2, 1), loc("src/b.ts", 1, 14)], lines)).toEqual([
    { column: 1, line: 2, path: "src/a.ts", text: "thing()" },
    { column: 14, line: 1, path: "src/b.ts", text: "export const thing = 1" },
  ]);
});
