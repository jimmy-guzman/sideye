import { readFileSync, statSync } from "node:fs"
import type { DiffTarget } from "./cli"
import { runCommand } from "./process"

export type ChangeKind = "modified" | "added" | "deleted" | "renamed" | "untracked"

export type StageState = "staged" | "unstaged" | "mixed" | "untracked"

export type ChangedFile = {
  path: string
  oldPath?: string
  kind: ChangeKind
  stage: StageState
  additions: number
  deletions: number
  binary: boolean
  warnings: string[]
  sortIndex: number
}

export type GitModel = {
  repoRoot: string
  files: ChangedFile[]
}

type StatusEntry = {
  path: string
  oldPath?: string
  kind: ChangeKind
}

export function loadGitModel(cwd: string, target: DiffTarget): GitModel {
  const repoRoot = runCommand(["git", "rev-parse", "--show-toplevel"], cwd).stdout.trim()
  const untracked = target.kind === "staged" ? [] : parseUntrackedFiles(runCommand(["git", "ls-files", "--others", "--exclude-standard", "-z"], repoRoot).stdout)
  const nameStatus = parseNameStatus(runCommand(nameStatusArgs(target), repoRoot).stdout)
  const statusByPath = new Map([...nameStatus, ...untracked].map((entry) => [entry.path, entry]))
  const numstat = parseNumstat(runCommand(numstatArgs(target), repoRoot).stdout)
  const numstatByPath = new Map(numstat.map((entry) => [entry.path, entry]))
  const stageByPath = parsePorcelainStatus(runCommand(["git", "status", "--porcelain=v1", "-z"], repoRoot).stdout)
  const paths = new Set([...numstatByPath.keys(), ...statusByPath.keys()])

  const files = Array.from(paths)
    .map((path, sortIndex) => {
      const stat = numstatByPath.get(path)
      const statusEntry = statusByPath.get(path)
      const kind = statusEntry?.kind ?? inferKind(path, stat?.deletions ?? 0, stat?.additions ?? 0)
      const untrackedStat = kind === "untracked" && stat === undefined ? statUntrackedFile(repoRoot, path) : undefined
      const oldPath = statusEntry?.oldPath
      const file: ChangedFile = {
        path,
        oldPath,
        kind,
        stage: stageByPath.get(path) ?? (kind === "untracked" ? "untracked" : "unstaged"),
        additions: stat?.additions ?? untrackedStat?.additions ?? 0,
        deletions: stat?.deletions ?? 0,
        binary: stat?.binary ?? untrackedStat?.binary ?? false,
        warnings: warningsFor(path, kind, stat?.additions ?? untrackedStat?.additions ?? 0, stat?.deletions ?? 0),
        sortIndex,
      }
      return file
    })
    .sort(compareFiles)
    .map((file, sortIndex) => ({ ...file, sortIndex }))

  return { repoRoot, files }
}

export function loadFileDiff(repoRoot: string, target: DiffTarget, file: ChangedFile) {
  if (file.kind === "untracked") {
    return runCommand(["git", "diff", "--no-index", "--", "/dev/null", file.path], repoRoot, [0, 1]).stdout
  }

  return runCommand([...diffArgs(target), "--", file.path], repoRoot, [0, 1]).stdout
}

export function parsePorcelainStatus(output: string): Map<string, StageState> {
  const stageByPath = new Map<string, StageState>()
  const tokens = output.split("\0")

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (token === undefined || token.length < 4) {
      continue
    }

    const stage = stageFromCodes(token[0] ?? " ", token[1] ?? " ")
    stageByPath.set(token.slice(3), stage)

    if (token[0] === "R" || token[0] === "C" || token[1] === "R" || token[1] === "C") {
      const original = tokens[index + 1]
      if (original !== undefined && original !== "") {
        stageByPath.set(original, stage)
      }
      index += 1
    }
  }

  return stageByPath
}

export function mergeModel(prev: GitModel, next: GitModel): GitModel {
  if (prev.repoRoot === next.repoRoot && signature(prev.files) === signature(next.files)) {
    return prev
  }

  const remaining = new Map(next.files.map((file) => [file.path, file]))
  const files: ChangedFile[] = []

  for (const file of prev.files) {
    const updated = remaining.get(file.path)
    if (updated !== undefined) {
      files.push(updated)
      remaining.delete(file.path)
    }
  }

  for (const file of next.files) {
    if (remaining.has(file.path)) {
      files.push(file)
    }
  }

  return { repoRoot: next.repoRoot, files }
}

function stageFromCodes(index: string, worktree: string): StageState {
  if (index === "?" && worktree === "?") {
    return "untracked"
  }

  const staged = index !== " " && index !== "?"
  const unstaged = worktree !== " " && worktree !== "?"
  if (staged && unstaged) {
    return "mixed"
  }

  return staged ? "staged" : "unstaged"
}

function signature(files: ChangedFile[]) {
  return files.map((file) => `${file.path}\0${file.kind}\0${file.stage}\0${file.additions}\0${file.deletions}`).join("\x01")
}

export function parseUntrackedFiles(output: string): StatusEntry[] {
  return output
    .split("\0")
    .filter((path) => path !== "")
    .map((path) => ({ path, kind: "untracked" }))
}

export function parseNumstat(output: string) {
  return output
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const [addedRaw = "0", deletedRaw = "0", ...pathParts] = line.split("\t")
      const path = normalizeNumstatPath(pathParts.join("\t"))
      const binary = addedRaw === "-" || deletedRaw === "-"
      return {
        path,
        additions: binary ? 0 : Number.parseInt(addedRaw, 10),
        deletions: binary ? 0 : Number.parseInt(deletedRaw, 10),
        binary,
      }
    })
}

export function parseNameStatus(output: string): StatusEntry[] {
  return output
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const [status = "M", firstPath = "", secondPath] = line.split("\t")
      const code = status[0]

      if (code === "R") {
        return { path: secondPath ?? firstPath, oldPath: firstPath, kind: "renamed" }
      }

      if (code === "A") {
        return { path: firstPath, kind: "added" }
      }

      if (code === "D") {
        return { path: firstPath, kind: "deleted" }
      }

      return { path: firstPath, kind: "modified" }
    })
}

function numstatArgs(target: DiffTarget) {
  if (target.kind === "staged") {
    return ["git", "diff", "--cached", "--numstat", target.ref]
  }

  return ["git", "diff", "--numstat", target.ref]
}

function nameStatusArgs(target: DiffTarget) {
  if (target.kind === "staged") {
    return ["git", "diff", "--cached", "--name-status", target.ref]
  }

  return ["git", "diff", "--name-status", target.ref]
}

function diffArgs(target: DiffTarget) {
  if (target.kind === "staged") {
    return ["git", "diff", "--cached", target.ref]
  }

  return ["git", "diff", target.ref]
}

function inferKind(path: string, deletions: number, additions: number): ChangeKind {
  if (deletions > 0 && additions === 0) {
    return "deleted"
  }

  if (additions > 0 && deletions === 0 && path !== "") {
    return "added"
  }

  return "modified"
}

function normalizeNumstatPath(path: string) {
  const braceMatch = path.match(/^(.*)\{([^{}]+) => ([^{}]+)\}(.*)$/)
  if (braceMatch) {
    return `${braceMatch[1]}${braceMatch[3]}${braceMatch[4]}`
  }

  const arrowIndex = path.indexOf(" => ")
  if (arrowIndex >= 0) {
    return path.slice(arrowIndex + 4)
  }

  return path
}

function compareFiles(a: ChangedFile, b: ChangedFile) {
  const warningDelta = b.warnings.length - a.warnings.length
  if (warningDelta !== 0) {
    return warningDelta
  }

  const deletionDelta = b.deletions - a.deletions
  if (deletionDelta !== 0) {
    return deletionDelta
  }

  const churnDelta = b.additions + b.deletions - (a.additions + a.deletions)
  if (churnDelta !== 0) {
    return churnDelta
  }

  return a.path.localeCompare(b.path)
}

function warningsFor(path: string, kind: ChangeKind, additions: number, deletions: number) {
  const warnings: string[] = []
  const filename = path.split("/").at(-1) ?? path

  if (kind === "deleted" || deletions > additions * 2) {
    warnings.push("deletions")
  }

  if (filename === "package.json" || filename.endsWith(".lock") || filename === "bun.lockb" || filename === "bun.lock") {
    warnings.push("deps")
  }

  if (additions + deletions > 500) {
    warnings.push("large")
  }

  if (kind === "untracked") {
    warnings.push("new")
  }

  return warnings
}

function statUntrackedFile(repoRoot: string, path: string) {
  const absolutePath = `${repoRoot}/${path}`
  const stat = statSync(absolutePath)

  if (!stat.isFile() || stat.size > 1_000_000) {
    return { additions: 0, binary: true }
  }

  const buffer = readFileSync(absolutePath)
  if (buffer.includes(0)) {
    return { additions: 0, binary: true }
  }

  const content = buffer.toString("utf8")
  const normalized = content.endsWith("\n") ? content.slice(0, -1) : content
  return { additions: normalized === "" ? 0 : normalized.split("\n").length, binary: false }
}
