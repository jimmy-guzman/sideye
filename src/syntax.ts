import { SyntaxStyle, getTreeSitterClient, type TreeSitterClient } from "@opentui/core"
import tsBundledHighlights from "../node_modules/@opentui/core/assets/typescript/highlights.scm" with { type: "file" }
import tsBundledWasm from "../node_modules/@opentui/core/assets/typescript/tree-sitter-typescript.wasm" with { type: "file" }
import bashHighlights from "../assets/tree-sitter/bash/highlights.scm" with { type: "file" }
import bashWasm from "../assets/tree-sitter/bash/tree-sitter-bash.wasm" with { type: "file" }
import jsonHighlights from "../assets/tree-sitter/json/highlights.scm" with { type: "file" }
import jsonWasm from "../assets/tree-sitter/json/tree-sitter-json.wasm" with { type: "file" }
import tsTestGlobalsHighlights from "../assets/tree-sitter/typescript/test-globals.scm" with { type: "file" }
import yamlHighlights from "../assets/tree-sitter/yaml/highlights.scm" with { type: "file" }
import yamlWasm from "../assets/tree-sitter/yaml/tree-sitter-yaml.wasm" with { type: "file" }
import { supportedFiletypeFor } from "./filetype"

export type SyntaxConfig =
  | {
      enabled: true
      style: SyntaxStyle
      treeSitterClient: TreeSitterClient
      status: string
    }
  | {
      enabled: false
      status: string
    }

export const sideyeSyntaxStyle = SyntaxStyle.fromStyles({
  default: { fg: "#e4e4e7" },
  comment: { fg: "#71717a", dim: true },
  "comment.documentation": { fg: "#71717a", italic: true },
  punctuation: { fg: "#a1a1aa" },
  "punctuation.special": { fg: "#f5a3d7" },
  keyword: { fg: "#ff4fb8", bold: true },
  type: { fg: "#f0abfc" },
  "type.builtin": { fg: "#f0abfc", bold: true },
  string: { fg: "#86efac" },
  "string.escape": { fg: "#f5a3d7" },
  "string.regexp": { fg: "#f5a3d7" },
  number: { fg: "#fbbf24" },
  boolean: { fg: "#fbbf24", bold: true },
  constant: { fg: "#fbbf24" },
  "constant.builtin": { fg: "#fbbf24", bold: true },
  function: { fg: "#67e8f9" },
  "function.builtin": { fg: "#67e8f9", bold: true },
  "function.test.suite": { fg: "#ff4fb8", bold: true },
  "function.test": { fg: "#f0abfc", bold: true },
  "function.test.assert": { fg: "#67e8f9", bold: true },
  property: { fg: "#93c5fd" },
  variable: { fg: "#e4e4e7" },
  "variable.builtin": { fg: "#f0abfc" },
  "variable.member": { fg: "#93c5fd" },
  operator: { fg: "#f5a3d7" },
  label: { fg: "#93c5fd" },
  constructor: { fg: "#f0abfc" },
  attribute: { fg: "#f0abfc", italic: true },
  module: { fg: "#93c5fd" },
  character: { fg: "#86efac" },
  escape: { fg: "#f5a3d7" },
  "string.special.key": { fg: "#93c5fd" },
  markup: { fg: "#e4e4e7" },
  // style resolution is exact name -> first dotted segment -> default, so
  // dotted markdown captures must be registered by their exact names
  "markup.heading": { fg: "#ff4fb8", bold: true },
  "markup.heading.1": { fg: "#ff4fb8", bold: true, underline: true },
  "markup.heading.2": { fg: "#ff4fb8", bold: true },
  "markup.heading.3": { fg: "#ff4fb8" },
  "markup.heading.4": { fg: "#ff4fb8" },
  "markup.heading.5": { fg: "#ff4fb8" },
  "markup.heading.6": { fg: "#ff4fb8" },
  "markup.link": { fg: "#67e8f9", underline: true },
  "markup.link.url": { fg: "#67e8f9", underline: true },
  "markup.link.label": { fg: "#93c5fd" },
  "markup.link.bracket.close": { fg: "#67e8f9" },
  "markup.raw": { fg: "#86efac" },
  "markup.raw.block": { fg: "#86efac" },
  "markup.list": { fg: "#ff4fb8" },
  "markup.list.checked": { fg: "#86efac" },
  "markup.list.unchecked": { fg: "#fbbf24" },
  "markup.quote": { fg: "#a1a1aa", italic: true },
  "markup.strong": { fg: "#e4e4e7", bold: true },
  "markup.italic": { fg: "#e4e4e7", italic: true },
  "markup.strikethrough": { fg: "#71717a", dim: true },
})

export async function createSyntaxConfig(): Promise<SyntaxConfig> {
  try {
    const treeSitterClient = getTreeSitterClient()
    treeSitterClient.addFiletypeParser({ filetype: "bash", queries: { highlights: [bashHighlights] }, wasm: bashWasm })
    treeSitterClient.addFiletypeParser({ filetype: "json", queries: { highlights: [jsonHighlights] }, wasm: jsonWasm })
    treeSitterClient.addFiletypeParser({ filetype: "yaml", queries: { highlights: [yamlHighlights] }, wasm: yamlWasm })
    await treeSitterClient.initialize()
    // re-register typescript after initialize() so this replaces the bundled
    // default; the alias must be re-supplied or tsx highlighting breaks
    treeSitterClient.addFiletypeParser({
      filetype: "typescript",
      aliases: ["typescriptreact"],
      queries: { highlights: [tsBundledHighlights, tsTestGlobalsHighlights] },
      wasm: tsBundledWasm,
    })
    return {
      enabled: true,
      style: sideyeSyntaxStyle,
      treeSitterClient,
      status: "syntax highlighting ready",
    }
  } catch (error) {
    return {
      enabled: false,
      status: error instanceof Error ? `syntax disabled: ${error.message}` : "syntax disabled",
    }
  }
}

export function diffFiletypeFor(path: string, syntax: SyntaxConfig) {
  if (!syntax.enabled) {
    return "text"
  }

  return supportedFiletypeFor(path) ?? "text"
}
