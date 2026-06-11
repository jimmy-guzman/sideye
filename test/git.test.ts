import { describe, expect, test } from "bun:test"
import { renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import {
  diffArgs,
  loadFileDiff,
  loadGitModel,
  mergeModel,
  nameStatusArgs,
  numstatArgs,
  parseNameStatus,
  parseNumstat,
  parsePorcelainStatus,
  parseUntrackedFiles,
  type ChangedFile,
  type GitModel,
} from "../src/git"
import { createFixtureRepo, runGit } from "../test/helpers"

function file(path: string, overrides: Partial<ChangedFile> = {}): ChangedFile {
  return { path, kind: "modified", stage: "unstaged", additions: 1, deletions: 0, binary: false, warnings: [], ...overrides }
}

function model(changed: ChangedFile[], repoFilesKey = "key", scopeKey = "all:HEAD"): GitModel {
  return {
    repoRoot: "/repo",
    scopeKey,
    changed,
    changedByPath: new Map(changed.map((entry) => [entry.path, entry])),
    repoFiles: changed.map((entry) => ({ path: entry.path, tracked: true })),
    repoFilesKey,
  }
}

describe("scope arguments", () => {
  test("all compares the worktree against the ref", () => {
    expect(diffArgs({ kind: "all", ref: "main" })).toEqual(["git", "diff", "main"])
    expect(numstatArgs({ kind: "all", ref: "main" })).toEqual(["git", "diff", "main", "--numstat"])
    expect(nameStatusArgs({ kind: "all", ref: "main" })).toEqual(["git", "diff", "main", "--name-status"])
  })

  test("staged compares the index against the ref", () => {
    expect(diffArgs({ kind: "staged", ref: "HEAD" })).toEqual(["git", "diff", "--cached", "HEAD"])
    expect(numstatArgs({ kind: "staged", ref: "HEAD" })).toEqual(["git", "diff", "--cached", "HEAD", "--numstat"])
  })

  test("unstaged compares the worktree against the index and ignores the ref", () => {
    expect(diffArgs({ kind: "unstaged", ref: "main" })).toEqual(["git", "diff"])
    expect(numstatArgs({ kind: "unstaged", ref: "main" })).toEqual(["git", "diff", "--numstat"])
    expect(nameStatusArgs({ kind: "unstaged", ref: "main" })).toEqual(["git", "diff", "--name-status"])
  })
})

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

describe("loadGitModel in a fixture repo", () => {
  test("survives a dangling untracked symlink instead of crashing", () => {
    const repoRoot = createFixtureRepo("sideye-git-symlink-", { "a.ts": "const a = 1\n" })
    try {
      symlinkSync("/nonexistent-target", join(repoRoot, "broken-link"))
      const loaded = loadGitModel(repoRoot, { kind: "all", ref: "HEAD" })
      expect(loaded.changedByPath.get("broken-link")).toMatchObject({ kind: "untracked", additions: 0 })
    } finally {
      rmSync(repoRoot, { recursive: true, force: true })
    }
  })

  test("diffs a rename as a rename, not a whole-file add", () => {
    const content = Array.from({ length: 12 }, (_, index) => `const line${index} = ${index}`).join("\n")
    const repoRoot = createFixtureRepo("sideye-git-rename-", { "src/old.ts": `${content}\n` })
    try {
      renameSync(join(repoRoot, "src", "old.ts"), join(repoRoot, "src", "new.ts"))
      writeFileSync(join(repoRoot, "src", "new.ts"), `${content}\nconst added = true\n`)
      runGit(repoRoot, ["add", "-A"])

      const scope = { kind: "all", ref: "HEAD" } as const
      const loaded = loadGitModel(repoRoot, scope)
      const renamed = loaded.changedByPath.get("src/new.ts")
      expect(renamed).toMatchObject({ kind: "renamed", oldPath: "src/old.ts" })
      if (renamed === undefined) {
        throw new Error("renamed file missing from model")
      }

      const diff = loadFileDiff(loaded.repoRoot, scope, renamed)
      const addedLines = diff.split("\n").filter((line) => line.startsWith("+") && !line.startsWith("+++"))
      expect(diff).toContain("rename from src/old.ts")
      expect(addedLines).toEqual(["+const added = true"])
    } finally {
      rmSync(repoRoot, { recursive: true, force: true })
    }
  })
})

describe("mergeModel", () => {
  test("returns the same reference when nothing changed", () => {
    const prev = model([file("a.ts"), file("b.ts")])
    const next = model([file("a.ts"), file("b.ts")])
    expect(mergeModel(prev, next)).toBe(prev)
  })

  test("returns the next model when churn changes", () => {
    const prev = model([file("a.ts")])
    const next = model([file("a.ts", { additions: 9 })])
    expect(mergeModel(prev, next)).toBe(next)
  })

  test("returns the next model when repo files change", () => {
    const prev = model([file("a.ts")], "before")
    const next = model([file("a.ts")], "after")
    expect(mergeModel(prev, next)).toBe(next)
  })

  test("returns the next model when the scope changes, even with identical content", () => {
    const prev = model([file("a.ts")], "key", "all:HEAD")
    const next = model([file("a.ts")], "key", "unstaged:HEAD")
    expect(mergeModel(prev, next)).toBe(next)
  })
})
