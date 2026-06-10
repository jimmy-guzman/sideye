import { describe, expect, test } from "bun:test"
import { helpText, parseArgs } from "../src/cli"

describe("parseArgs", () => {
  test("defaults to worktree vs HEAD", () => {
    expect(parseArgs([]).target).toEqual({ kind: "worktree", ref: "HEAD" })
  })

  test("accepts a comparison ref", () => {
    expect(parseArgs(["main"]).target).toEqual({ kind: "worktree", ref: "main" })
  })

  test("supports staged comparisons", () => {
    expect(parseArgs(["--staged", "HEAD~2"]).target).toEqual({ kind: "staged", ref: "HEAD~2" })
  })

  test("describes focus and copy keys clearly", () => {
    expect(helpText()).toContain("tab        switch focus between the file list and the diff")
    expect(helpText()).toContain("j/down     move cursor down a line")
    expect(helpText()).toContain("y          copy path:line + snippet at the cursor")
    expect(helpText()).toContain("r          re-run checks")
    expect(helpText()).toContain("The view is live")
  })
})
