import { SyntaxStyle, getTreeSitterClient, type TreeSitterClient } from "@opentui/core"
import { supportedFiletypeFor } from "./filetype"
import { languages } from "./languages"

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

type CaptureStyles = Parameters<typeof SyntaxStyle.fromStyles>[0]

// The theme lives at the semantic-group level; expandCaptureStyles aliases the
// Dotted captures each grammar actually emits onto these entries
export const baseCaptureStyles: CaptureStyles = {
  attribute: { fg: "#f0abfc", italic: true },
  boolean: { bold: true, fg: "#fbbf24" },
  character: { fg: "#86efac" },
  comment: { dim: true, fg: "#71717a" },
  "comment.documentation": { fg: "#71717a", italic: true },
  constant: { fg: "#fbbf24" },
  "constant.builtin": { bold: true, fg: "#fbbf24" },
  constructor: { fg: "#f0abfc" },
  default: { fg: "#e4e4e7" },
  escape: { fg: "#f5a3d7" },
  function: { fg: "#67e8f9" },
  "function.builtin": { bold: true, fg: "#67e8f9" },
  "function.test": { bold: true, fg: "#f0abfc" },
  "function.test.assert": { bold: true, fg: "#67e8f9" },
  "function.test.suite": { bold: true, fg: "#ff4fb8" },
  keyword: { bold: true, fg: "#ff4fb8" },
  label: { fg: "#93c5fd" },
  markup: { fg: "#e4e4e7" },
  "markup.heading": { bold: true, fg: "#ff4fb8" },
  "markup.heading.1": { bold: true, fg: "#ff4fb8", underline: true },
  "markup.heading.2": { bold: true, fg: "#ff4fb8" },
  "markup.heading.3": { fg: "#ff4fb8" },
  "markup.heading.4": { fg: "#ff4fb8" },
  "markup.heading.5": { fg: "#ff4fb8" },
  "markup.heading.6": { fg: "#ff4fb8" },
  "markup.italic": { fg: "#e4e4e7", italic: true },
  "markup.link": { fg: "#67e8f9", underline: true },
  "markup.link.bracket.close": { fg: "#67e8f9" },
  "markup.link.label": { fg: "#93c5fd" },
  "markup.list": { fg: "#ff4fb8" },
  "markup.list.checked": { fg: "#86efac" },
  "markup.list.unchecked": { fg: "#fbbf24" },
  "markup.quote": { fg: "#a1a1aa", italic: true },
  "markup.raw": { fg: "#86efac" },
  "markup.strikethrough": { dim: true, fg: "#71717a" },
  "markup.strong": { bold: true, fg: "#e4e4e7" },
  module: { fg: "#93c5fd" },
  number: { fg: "#fbbf24" },
  operator: { fg: "#f5a3d7" },
  property: { fg: "#93c5fd" },
  punctuation: { fg: "#a1a1aa" },
  "punctuation.special": { fg: "#f5a3d7" },
  string: { fg: "#86efac" },
  "string.escape": { fg: "#f5a3d7" },
  "string.regexp": { fg: "#f5a3d7" },
  "string.special.key": { fg: "#93c5fd" },
  type: { fg: "#f0abfc" },
  "type.builtin": { bold: true, fg: "#f0abfc" },
  variable: { fg: "#e4e4e7" },
  "variable.builtin": { fg: "#f0abfc" },
  "variable.member": { fg: "#93c5fd" },
}

// OpenTUI resolves a capture as exact name -> first dotted segment -> default,
// So a dotted capture without an exact entry silently loses its specific
// Style. Alias every dotted capture the given queries emit to its longest
// Styled prefix (e.g. a future "keyword.import" -> "keyword").
export function expandCaptureStyles(querySources: string[]): CaptureStyles {
  const expanded = { ...baseCaptureStyles }

  for (const source of querySources) {
    for (const name of captureNames(source)) {
      if (expanded[name] !== undefined || !name.includes(".")) {
        continue
      }

      const parts = name.split(".")
      for (let length = parts.length - 1; length >= 1; length -= 1) {
        const style = expanded[parts.slice(0, length).join(".")]
        if (style !== undefined) {
          expanded[name] = style
          break
        }
      }
    }
  }

  return expanded
}

function captureNames(source: string) {
  const matches = source.match(/@[\w.]+/g) ?? []
  return new Set(matches.map((capture) => capture.slice(1)).filter((name) => !name.startsWith("_")))
}

export async function createSyntaxConfig(): Promise<SyntaxConfig> {
  try {
    const treeSitterClient = getTreeSitterClient()

    for (const language of languages) {
      if (language.wasm !== undefined && language.replacesBundled !== true) {
        treeSitterClient.addFiletypeParser({
          aliases: language.aliases,
          filetype: language.filetype,
          queries: { highlights: language.highlights },
          wasm: language.wasm,
        })
      }
    }

    await treeSitterClient.initialize()

    // A parser that replaces a bundled one must register after initialize()
    // Or the bundled default wins; aliases must be re-supplied
    for (const language of languages) {
      if (language.wasm !== undefined && language.replacesBundled === true) {
        treeSitterClient.addFiletypeParser({
          aliases: language.aliases,
          filetype: language.filetype,
          queries: { highlights: language.highlights },
          wasm: language.wasm,
        })
      }
    }

    const querySources = await Promise.all(languages.flatMap((language) => language.highlights).map((path) => Bun.file(path).text()))

    return {
      enabled: true,
      status: "syntax highlighting ready",
      style: SyntaxStyle.fromStyles(expandCaptureStyles(querySources)),
      treeSitterClient,
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
