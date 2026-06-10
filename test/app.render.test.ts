import { describe, expect, test } from "bun:test"
import { createTestRenderer } from "@opentui/core/testing"
import { createRoot } from "@opentui/react"
import { createElement } from "react"
import { App } from "../src/App"
import { loadGitModel } from "../src/git"
import type { SyntaxConfig } from "../src/syntax"

const syntax: SyntaxConfig = { enabled: false, status: "syntax disabled for tests" }

describe("App rendering", () => {
  test("renders the repo tree, scope label, and status bar", async () => {
    const model = loadGitModel(process.cwd(), { kind: "all", ref: "HEAD" })
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 110, height: 32 })

    createRoot(renderer).render(createElement(App, { model, scope: { kind: "all", ref: "HEAD" }, syntax }))
    await new Promise((resolve) => setTimeout(resolve, 300))
    await renderOnce()
    const frame = captureCharFrame()

    expect(frame).toContain("torre")
    expect(frame).toContain("worktree vs HEAD")
    expect(frame).toContain("src/")
    expect(frame).toContain("test/")
    expect(frame).toContain("q quit")

    renderer.destroy()
  })
})
