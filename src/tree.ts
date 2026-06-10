import type { CheckerState } from "./diagnostics"
import { summarizeBadges } from "./diagnostics"
import type { ChangedFile } from "./git"

export type FileTreeNode =
  | {
      type: "directory"
      id: string
      name: string
      path: string
      depth: number
      additions: number
      deletions: number
      fileCount: number
      warnings: string[]
      children: FileTreeNode[]
    }
  | {
      type: "file"
      id: string
      name: string
      path: string
      depth: number
      additions: number
      deletions: number
      warnings: string[]
      file: ChangedFile
    }

export type FileTreeRow = {
  node: FileTreeNode
  index: number
}

type MutableDirectory = Extract<FileTreeNode, { type: "directory" }>

export function buildFileTree(files: ChangedFile[]) {
  const root: MutableDirectory = {
    type: "directory",
    id: ".",
    name: ".",
    path: "",
    depth: -1,
    additions: 0,
    deletions: 0,
    fileCount: 0,
    warnings: [],
    children: [],
  }

  const directories = new Map<string, MutableDirectory>([["", root]])

  for (const file of files) {
    const parts = file.path.split("/")
    let parent = root
    let currentPath = ""

    for (const directoryName of parts.slice(0, -1)) {
      currentPath = currentPath === "" ? directoryName : `${currentPath}/${directoryName}`
      let directory = directories.get(currentPath)

      if (directory === undefined) {
        directory = {
          type: "directory",
          id: `dir:${currentPath}`,
          name: directoryName,
          path: currentPath,
          depth: currentPath.split("/").length - 1,
          additions: 0,
          deletions: 0,
          fileCount: 0,
          warnings: [],
          children: [],
        }
        directories.set(currentPath, directory)
        parent.children.push(directory)
      }

      parent = directory
    }

    parent.children.push({
      type: "file",
      id: `file:${file.path}`,
      name: parts.at(-1) ?? file.path,
      path: file.path,
      depth: parts.length - 1,
      additions: file.additions,
      deletions: file.deletions,
      warnings: file.warnings,
      file,
    })
  }

  aggregateDirectory(root)
  sortTree(root)
  return root.children
}

export function defaultExpandedDirectories(nodes: FileTreeNode[]) {
  const expanded = new Set<string>()

  const visit = (node: FileTreeNode) => {
    if (node.type === "file") {
      return
    }

    if (node.fileCount < 8) {
      expanded.add(node.id)
    }

    for (const child of node.children) {
      visit(child)
    }
  }

  for (const node of nodes) {
    visit(node)
  }

  return expanded
}

export function expandAncestorsForPath(expanded: Set<string>, path: string) {
  const next = new Set(expanded)
  const parts = path.split("/")

  for (let index = 1; index < parts.length; index += 1) {
    next.add(`dir:${parts.slice(0, index).join("/")}`)
  }

  return next
}

export function flattenTree(nodes: FileTreeNode[], expanded: Set<string>) {
  const rows: FileTreeRow[] = []

  const visit = (node: FileTreeNode) => {
    rows.push({ node, index: rows.length })

    if (node.type === "directory" && expanded.has(node.id)) {
      for (const child of node.children) {
        visit(child)
      }
    }
  }

  for (const node of nodes) {
    visit(node)
  }

  return rows
}

export function describeTreeNode(node: FileTreeNode, checkerState: CheckerState) {
  const churn = `+${node.additions} -${node.deletions}`
  const warnings = node.warnings.length === 0 ? "" : ` !${node.warnings.join(",")}`

  if (node.type === "directory") {
    return `${churn}${warnings}  ${node.fileCount} files`
  }

  return `${churn}${warnings}  ${summarizeBadges(node.path, checkerState).join(" ")}`
}

export function findRowIndexForPath(rows: FileTreeRow[], path: string) {
  return rows.findIndex((row) => row.node.type === "file" && row.node.path === path)
}

export function firstFileInNode(node: FileTreeNode): ChangedFile | undefined {
  if (node.type === "file") {
    return node.file
  }

  for (const child of node.children) {
    const file = firstFileInNode(child)
    if (file !== undefined) {
      return file
    }
  }

  return undefined
}

function aggregateDirectory(directory: MutableDirectory) {
  const warnings = new Set<string>()
  let additions = 0
  let deletions = 0
  let fileCount = 0

  for (const child of directory.children) {
    if (child.type === "directory") {
      aggregateDirectory(child)
    }

    additions += child.additions
    deletions += child.deletions
    for (const warning of child.warnings) {
      warnings.add(warning)
    }
    fileCount += child.type === "file" ? 1 : child.fileCount
  }

  directory.additions = additions
  directory.deletions = deletions
  directory.fileCount = fileCount
  directory.warnings = Array.from(warnings)
}

function sortTree(directory: MutableDirectory) {
  directory.children.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "directory" ? -1 : 1
    }

    const warningDelta = b.warnings.length - a.warnings.length
    if (warningDelta !== 0) {
      return warningDelta
    }

    const churnDelta = b.additions + b.deletions - (a.additions + a.deletions)
    if (churnDelta !== 0) {
      return churnDelta
    }

    return a.name.localeCompare(b.name)
  })

  for (const child of directory.children) {
    if (child.type === "directory") {
      sortTree(child)
    }
  }
}
