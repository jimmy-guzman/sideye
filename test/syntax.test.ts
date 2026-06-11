import { getTreeSitterClient } from "@opentui/core"
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { diffFiletypeFor, sideyeSyntaxStyle, type SyntaxConfig } from "../src/syntax"

const disabledSyntax: SyntaxConfig = {
  enabled: false,
  status: "syntax disabled",
}

const enabledSyntax: SyntaxConfig = {
  enabled: true,
  status: "syntax highlighting ready",
  style: sideyeSyntaxStyle,
  treeSitterClient: getTreeSitterClient(),
}

describe("diffFiletypeFor", () => {
  test("uses supported parser filetypes when syntax is enabled", () => {
    expect(diffFiletypeFor("src/App.tsx", enabledSyntax)).toBe("typescript")
    expect(diffFiletypeFor("README.md", enabledSyntax)).toBe("markdown")
    expect(diffFiletypeFor("install.sh", enabledSyntax)).toBe("bash")
    expect(diffFiletypeFor("package.json", enabledSyntax)).toBe("json")
    expect(diffFiletypeFor("tsconfig.jsonc", enabledSyntax)).toBe("json")
    expect(diffFiletypeFor(".github/workflows/ci.yml", enabledSyntax)).toBe("yaml")
    expect(diffFiletypeFor("config.yaml", enabledSyntax)).toBe("yaml")
  })

  test("falls back to text for unsupported or disabled syntax", () => {
    expect(diffFiletypeFor("bun.lock", enabledSyntax)).toBe("text")
    expect(diffFiletypeFor("src/App.tsx", disabledSyntax)).toBe("text")
  })
})

describe("sideyeSyntaxStyle capture coverage", () => {
  const repoRoot = join(import.meta.dir, "..")
  const queryFiles = [
    join(repoRoot, "assets/tree-sitter/bash/highlights.scm"),
    join(repoRoot, "assets/tree-sitter/json/highlights.scm"),
    join(repoRoot, "assets/tree-sitter/yaml/highlights.scm"),
    join(repoRoot, "assets/tree-sitter/typescript/test-globals.scm"),
    join(repoRoot, "node_modules/@opentui/core/assets/javascript/highlights.scm"),
    join(repoRoot, "node_modules/@opentui/core/assets/typescript/highlights.scm"),
    join(repoRoot, "node_modules/@opentui/core/assets/zig/highlights.scm"),
    join(repoRoot, "node_modules/@opentui/core/assets/markdown/highlights.scm"),
    join(repoRoot, "node_modules/@opentui/core/assets/markdown_inline/highlights.scm"),
  ]

  // meta captures that intentionally carry no style of their own
  const metaCaptures = new Set(["spell", "nospell", "conceal", "none", "embedded", "cImport", "import", "_lang", ""])

  // style resolution is exact name -> first dotted segment -> default, so
  // every dotted capture a grammar emits must resolve without hitting default
  test("every emitted capture resolves to a registered style", () => {
    const unresolved: string[] = []
    for (const file of queryFiles) {
      const scm = readFileSync(file, "utf8")
      const captures = new Set((scm.match(/@[\w.]*/g) ?? []).map((capture) => capture.slice(1)))
      for (const capture of captures) {
        if (metaCaptures.has(capture)) {
          continue
        }
        if (sideyeSyntaxStyle.getStyle(capture) === undefined) {
          unresolved.push(`@${capture} (${file})`)
        }
      }
    }
    expect(unresolved).toEqual([])
  })
})
