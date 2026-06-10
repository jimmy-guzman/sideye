import { describe, expect, test } from "bun:test"
import { buildFileTree, defaultExpandedDirectories, expandAncestorsForPath, findRowIndexForPath, firstFileInNode, flattenTree } from "../src/tree"
import type { ChangedFile } from "../src/git"

const files: ChangedFile[] = [
  { path: "src/App.tsx", kind: "added", stage: "staged", additions: 10, deletions: 0, binary: false, warnings: ["new"], sortIndex: 0 },
  { path: "src/git.ts", kind: "modified", stage: "unstaged", additions: 3, deletions: 1, binary: false, warnings: [], sortIndex: 1 },
  { path: "README.md", kind: "modified", stage: "mixed", additions: 1, deletions: 1, binary: false, warnings: [], sortIndex: 2 },
]

describe("file tree", () => {
  test("builds directory and file rows with aggregate churn", () => {
    const tree = buildFileTree(files)
    const src = tree.find((node) => node.type === "directory" && node.path === "src")

    expect(src).toMatchObject({ type: "directory", additions: 13, deletions: 1, fileCount: 2 })
  })

  test("flattens expanded directories", () => {
    const tree = buildFileTree(files)
    const expanded = defaultExpandedDirectories(tree)
    const rows = flattenTree(tree, expanded)

    expect(rows.map((row) => row.node.path)).toContain("src/App.tsx")
    expect(findRowIndexForPath(rows, "src/git.ts")).toBeGreaterThan(0)
  })

  test("finds first file in a directory", () => {
    const tree = buildFileTree(files)
    const src = tree.find((node) => node.type === "directory" && node.path === "src")

    expect(src === undefined ? undefined : firstFileInNode(src)?.path).toBe("src/App.tsx")
  })

  test("expands ancestors for a selected path", () => {
    expect(Array.from(expandAncestorsForPath(new Set(), "src/ui/App.tsx"))).toEqual(["dir:src", "dir:src/ui"])
  })
})
