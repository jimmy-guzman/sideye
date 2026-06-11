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

// the theme lives at the semantic-group level; expandCaptureStyles aliases the
// dotted captures each grammar actually emits onto these entries
export const baseCaptureStyles: CaptureStyles = {
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
  "string.special.key": { fg: "#93c5fd" },
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
  markup: { fg: "#e4e4e7" },
  "markup.heading": { fg: "#ff4fb8", bold: true },
  "markup.heading.1": { fg: "#ff4fb8", bold: true, underline: true },
  "markup.heading.2": { fg: "#ff4fb8", bold: true },
  "markup.heading.3": { fg: "#ff4fb8" },
  "markup.heading.4": { fg: "#ff4fb8" },
  "markup.heading.5": { fg: "#ff4fb8" },
  "markup.heading.6": { fg: "#ff4fb8" },
  "markup.link": { fg: "#67e8f9", underline: true },
  "markup.link.label": { fg: "#93c5fd" },
  "markup.link.bracket.close": { fg: "#67e8f9" },
  "markup.raw": { fg: "#86efac" },
  "markup.list": { fg: "#ff4fb8" },
  "markup.list.checked": { fg: "#86efac" },
  "markup.list.unchecked": { fg: "#fbbf24" },
  "markup.quote": { fg: "#a1a1aa", italic: true },
  "markup.strong": { fg: "#e4e4e7", bold: true },
  "markup.italic": { fg: "#e4e4e7", italic: true },
  "markup.strikethrough": { fg: "#71717a", dim: true },
}

// OpenTUI resolves a capture as exact name -> first dotted segment -> default,
// so a dotted capture without an exact entry silently loses its specific
// style. Alias every dotted capture the given queries emit to its longest
// styled prefix (e.g. a future "keyword.import" -> "keyword").
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
          filetype: language.filetype,
          aliases: language.aliases,
          queries: { highlights: language.highlights },
          wasm: language.wasm,
        })
      }
    }

    await treeSitterClient.initialize()

    // a parser that replaces a bundled one must register after initialize()
    // or the bundled default wins; aliases must be re-supplied
    for (const language of languages) {
      if (language.wasm !== undefined && language.replacesBundled === true) {
        treeSitterClient.addFiletypeParser({
          filetype: language.filetype,
          aliases: language.aliases,
          queries: { highlights: language.highlights },
          wasm: language.wasm,
        })
      }
    }

    const querySources = await Promise.all(languages.flatMap((language) => language.highlights).map((path) => Bun.file(path).text()))

    return {
      enabled: true,
      style: SyntaxStyle.fromStyles(expandCaptureStyles(querySources)),
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
