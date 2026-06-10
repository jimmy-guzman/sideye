import { describe, expect, test } from "bun:test"
import { mergeModel, parseNameStatus, parseNumstat, parsePorcelainStatus, parseUntrackedFiles, type ChangedFile, type GitModel } from "../src/git"

function file(path: string, overrides: Partial<ChangedFile> = {}): ChangedFile {
  return { path, kind: "modified", stage: "unstaged", additions: 1, deletions: 0, binary: false, warnings: [], sortIndex: 0, ...overrides }
}

describe("parseUntrackedFiles", () => {
  test("parses nul-delimited untracked files without directory placeholders", () => {
    expect(parseUntrackedFiles("src/App.tsx\0src/git.ts\0")).toEqual([
      { path: "src/App.tsx", kind: "untracked" },
      { path: "src/git.ts", kind: "untracked" },
    ])
  })
})

describe("parseNumstat", () => {
  test("parses text and binary churn", () => {
    expect(parseNumstat("10\t2\tsrc/a.ts\n-\t-\timage.png\n")).toEqual([
      { path: "src/a.ts", additions: 10, deletions: 2, binary: false },
      { path: "image.png", additions: 0, deletions: 0, binary: true },
    ])
  })

  test("normalizes renamed brace paths", () => {
    expect(parseNumstat("1\t1\tsrc/{old.ts => new.ts}\n")).toEqual([{ path: "src/new.ts", additions: 1, deletions: 1, binary: false }])
  })
})

describe("parseNameStatus", () => {
  test("parses tracked diff status", () => {
    expect(parseNameStatus("M\tsrc/a.ts\nA\tsrc/b.ts\nD\tsrc/c.ts\nR100\tsrc/d.ts\tsrc/e.ts\n")).toEqual([
      { path: "src/a.ts", kind: "modified" },
      { path: "src/b.ts", kind: "added" },
      { path: "src/c.ts", kind: "deleted" },
      { path: "src/e.ts", oldPath: "src/d.ts", kind: "renamed" },
    ])
  })
})

describe("parsePorcelainStatus", () => {
  test("derives staged, unstaged, mixed, and untracked", () => {
    const stages = parsePorcelainStatus("M  staged.ts\0 M unstaged.ts\0MM mixed.ts\0?? new.ts\0")
    expect(stages.get("staged.ts")).toBe("staged")
    expect(stages.get("unstaged.ts")).toBe("unstaged")
    expect(stages.get("mixed.ts")).toBe("mixed")
    expect(stages.get("new.ts")).toBe("untracked")
  })

  test("maps both rename paths and consumes the original token", () => {
    const stages = parsePorcelainStatus("R  new.ts\0old.ts\0 M after.ts\0")
    expect(stages.get("new.ts")).toBe("staged")
    expect(stages.get("old.ts")).toBe("staged")
    expect(stages.get("after.ts")).toBe("unstaged")
  })
})

describe("mergeModel", () => {
  const root = "/repo"

  test("returns the same reference when nothing changed", () => {
    const prev: GitModel = { repoRoot: root, files: [file("a.ts"), file("b.ts")] }
    const next: GitModel = { repoRoot: root, files: [file("a.ts"), file("b.ts")] }
    expect(mergeModel(prev, next)).toBe(prev)
  })

  test("preserves order, appends new, drops removed", () => {
    const prev: GitModel = { repoRoot: root, files: [file("a.ts"), file("b.ts")] }
    const next: GitModel = { repoRoot: root, files: [file("c.ts"), file("b.ts", { additions: 9 }), file("a.ts")] }
    const merged = mergeModel(prev, next)
    expect(merged.files.map((f) => f.path)).toEqual(["a.ts", "b.ts", "c.ts"])
    expect(merged.files.find((f) => f.path === "b.ts")?.additions).toBe(9)
  })

  test("drops files that disappeared", () => {
    const prev: GitModel = { repoRoot: root, files: [file("a.ts"), file("gone.ts")] }
    const next: GitModel = { repoRoot: root, files: [file("a.ts")] }
    expect(mergeModel(prev, next).files.map((f) => f.path)).toEqual(["a.ts"])
  })
})
