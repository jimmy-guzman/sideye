import { describe, expect, test } from "bun:test"
import { formatCopyReference } from "../src/copy-reference"

describe("copy reference formatting", () => {
  test("formats path-only fallback", () => {
    expect(formatCopyReference({ path: "src/a.ts" })).toBe("src/a.ts")
  })

  test("formats path line and snippet", () => {
    expect(formatCopyReference({ path: "src/a.ts", line: 2, snippet: "const a = 1" })).toBe("src/a.ts:2\nconst a = 1")
  })

  test("formats path and line without a snippet", () => {
    expect(formatCopyReference({ path: "src/a.ts", line: 2 })).toBe("src/a.ts:2")
  })
})
