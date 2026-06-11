import { readFileSync, statSync } from "node:fs"
import { runCommand } from "./process"

export type FileContent =
  | { kind: "text"; content: string; lineCount: number; truncated: boolean }
  | { kind: "binary" }
  | { kind: "missing" }
  | { kind: "too-large"; bytes: number }

export const MAX_FILE_BYTES = 1_000_000
export const MAX_FILE_LINES = 5_000

export type LoadFileContentOptions = {
  full: boolean
  gitSpec?: string
}

export function loadFileContent(repoRoot: string, path: string, options: LoadFileContentOptions): FileContent {
  if (options.gitSpec !== undefined) {
    try {
      return textContent(runCommand(["git", "show", options.gitSpec], repoRoot).stdout, options.full)
    } catch {
      return { kind: "missing" }
    }
  }

  const absolutePath = `${repoRoot}/${path}`
  let size: number
  try {
    const stat = statSync(absolutePath)
    if (!stat.isFile()) {
      return { kind: "binary" }
    }
    size = stat.size
  } catch {
    return { kind: "missing" }
  }

  if (size > MAX_FILE_BYTES && !options.full) {
    return { kind: "too-large", bytes: size }
  }

  let buffer: Buffer
  try {
    buffer = readFileSync(absolutePath)
  } catch {
    return { kind: "missing" }
  }

  if (buffer.subarray(0, 8_000).includes(0)) {
    return { kind: "binary" }
  }

  return textContent(buffer.toString("utf8"), options.full)
}

export function textContent(content: string, full: boolean): FileContent {
  const normalized = content.endsWith("\n") ? content.slice(0, -1) : content
  const lines = normalized === "" ? [] : normalized.split("\n")

  if (!full && lines.length > MAX_FILE_LINES) {
    return { kind: "text", content: lines.slice(0, MAX_FILE_LINES).join("\n"), lineCount: lines.length, truncated: true }
  }

  return { kind: "text", content: normalized, lineCount: lines.length, truncated: false }
}

export function contentToContextPatch(path: string, content: string) {
  const header = [`--- a/${path}`, `+++ b/${path}`]
  if (content === "") {
    return header.join("\n")
  }

  const lines = content.split("\n")
  return [...header, `@@ -1,${lines.length} +1,${lines.length} @@`, ...lines.map((line) => ` ${line}`)].join("\n")
}
