import jsBundledHighlights from "../node_modules/@opentui/core/assets/javascript/highlights.scm" with { type: "file" }
import markdownBundledHighlights from "../node_modules/@opentui/core/assets/markdown/highlights.scm" with { type: "file" }
import markdownInlineBundledHighlights from "../node_modules/@opentui/core/assets/markdown_inline/highlights.scm" with { type: "file" }
import tsBundledHighlights from "../node_modules/@opentui/core/assets/typescript/highlights.scm" with { type: "file" }
import tsBundledWasm from "../node_modules/@opentui/core/assets/typescript/tree-sitter-typescript.wasm" with { type: "file" }
import zigBundledHighlights from "../node_modules/@opentui/core/assets/zig/highlights.scm" with { type: "file" }
import bashHighlights from "../assets/tree-sitter/bash/highlights.scm" with { type: "file" }
import bashWasm from "../assets/tree-sitter/bash/tree-sitter-bash.wasm" with { type: "file" }
import jsonHighlights from "../assets/tree-sitter/json/highlights.scm" with { type: "file" }
import jsonWasm from "../assets/tree-sitter/json/tree-sitter-json.wasm" with { type: "file" }
import tsTestGlobalsHighlights from "../assets/tree-sitter/typescript/test-globals.scm" with { type: "file" }
import yamlHighlights from "../assets/tree-sitter/yaml/highlights.scm" with { type: "file" }
import yamlWasm from "../assets/tree-sitter/yaml/tree-sitter-yaml.wasm" with { type: "file" }

export type Language = {
  filetype: string
  extensions: string[]
  // every highlight query the filetype renders with; also feeds capture-style expansion
  highlights: string[]
  // grammar to register with the tree-sitter client; absent means the parser
  // ships bundled with @opentui/core and registers itself
  wasm?: string
  aliases?: string[]
  // a bundled parser can only be replaced after the client initializes
  replacesBundled?: boolean
}

// one language = one entry (plus asset files); filetype.ts and syntax.ts both
// derive from this table
export const languages: Language[] = [
  {
    filetype: "typescript",
    extensions: [".ts", ".tsx"],
    highlights: [tsBundledHighlights, tsTestGlobalsHighlights],
    wasm: tsBundledWasm,
    aliases: ["typescriptreact"],
    replacesBundled: true,
  },
  { filetype: "javascript", extensions: [".js", ".jsx"], highlights: [jsBundledHighlights] },
  { filetype: "bash", extensions: [".sh", ".bash", ".zsh"], highlights: [bashHighlights], wasm: bashWasm },
  { filetype: "json", extensions: [".json", ".jsonc"], highlights: [jsonHighlights], wasm: jsonWasm },
  { filetype: "yaml", extensions: [".yaml", ".yml"], highlights: [yamlHighlights], wasm: yamlWasm },
  { filetype: "markdown", extensions: [".md", ".mdx"], highlights: [markdownBundledHighlights, markdownInlineBundledHighlights] },
  { filetype: "zig", extensions: [".zig"], highlights: [zigBundledHighlights] },
]
