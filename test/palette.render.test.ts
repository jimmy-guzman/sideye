import { describe, expect, test } from "bun:test"
import { createTestRenderer } from "@opentui/core/testing"
import { createRoot } from "@opentui/react"
import { createElement } from "react"
import { App } from "../src/App"
import { loadGitModel } from "../src/git"
import type { SyntaxConfig } from "../src/syntax"

const syntax: SyntaxConfig = { enabled: false, status: "syntax disabled for tests" }

describe("go-to-file palette", () => {
  test("opens with ctrl-p, swallows global keys, fuzzy-jumps on enter", async () => {
    const model = loadGitModel(process.cwd(), { kind: "all", ref: "HEAD" })
    const { renderer, renderOnce, captureCharFrame, mockInput } = await createTestRenderer({ width: 120, height: 34 })

    // flush()/waitForFrame() do not pump the React reconciler's async commit,
    // so settle with a quiet period and a single renderOnce per step; rapid
    // renderOnce polling around mock input wedges the test renderer
    const settle = async () => {
      await new Promise((resolve) => setTimeout(resolve, 250))
      await renderOnce()
    }

    createRoot(renderer).render(createElement(App, { model, scope: { kind: "all", ref: "HEAD" }, syntax }))
    await settle()
    expect(captureCharFrame()).toContain("torre")

    await mockInput.pressKeys(["\x10"]) // ctrl-p
    await settle()
    expect(captureCharFrame()).toContain("go to file")

    // q must feed the input and show "no matches", not quit the app
    await mockInput.typeText("qqqq")
    await settle()
    const afterTyping = captureCharFrame()
    expect(afterTyping).toContain("torre")
    expect(afterTyping).toContain("no matches")

    for (let index = 0; index < 4; index += 1) {
      mockInput.pressBackspace()
    }
    await mockInput.typeText("treets")
    await settle()
    expect(captureCharFrame()).toContain("src/tree.ts")

    mockInput.pressEnter()
    await settle()
    const after = captureCharFrame()
    expect(after).toContain("src/tree.ts ·")
    expect(after).not.toContain("go to file")

    renderer.destroy()
  }, 20_000)
})
