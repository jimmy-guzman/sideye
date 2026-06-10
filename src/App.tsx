import { RGBA, type DiffRenderable, type LineColorConfig, type ScrollBoxRenderable } from "@opentui/core"
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react"
import { useEffect, useMemo, useRef, useState } from "react"
import type { DiffTarget } from "./cli"
import { fileHasFindings, initialCheckerState, markPending, runDiagnostics, type CheckerState } from "./diagnostics"
import type { ChangedFile, GitModel, StageState } from "./git"
import { loadFileDiff, loadGitModel, mergeModel } from "./git"
import { lineReference, renderPatch } from "./patch"
import { diffFiletypeFor, type SyntaxConfig } from "./syntax"
import { buildFileTree, defaultExpandedDirectories, describeTreeNode, expandAncestorsForPath, findRowIndexForPath, firstFileInNode, flattenTree, type FileTreeNode, type FileTreeRow } from "./tree"
import { copyToClipboard, formatCopyReference } from "./copy-reference"

type AppProps = {
  model: GitModel
  target: DiffTarget
  syntax: SyntaxConfig
}

type ScrollablePane = { scrollY: number; maxScrollY: number }

const DIFF_ID = "ojo-diff"
const CURSOR_BG = RGBA.fromHex("#3a1530")
const ADDED_BG = RGBA.fromHex("#102a1c")
const REMOVED_BG = RGBA.fromHex("#32131f")
const TRANSPARENT = RGBA.fromValues(0, 0, 0, 0)

export function App({ model: initialModel, target, syntax }: AppProps) {
  const renderer = useRenderer()
  const { width, height } = useTerminalDimensions()
  const [model, setModel] = useState(initialModel)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [focusedRowIndex, setFocusedRowIndex] = useState(0)
  const [checkerState, setCheckerState] = useState<CheckerState>(() => initialCheckerState(initialModel.files))
  const [status, setStatus] = useState(syntax.status)
  const [expandedDirectories, setExpandedDirectories] = useState(() => {
    const expanded = defaultExpandedDirectories(buildFileTree(initialModel.files))
    return initialModel.files[0] === undefined ? expanded : expandAncestorsForPath(expanded, initialModel.files[0].path)
  })
  const [fullDiffPaths, setFullDiffPaths] = useState<Set<string>>(() => new Set())
  const [focusedPane, setFocusedPane] = useState<"tree" | "diff">("tree")
  const [cursorIndex, setCursorIndex] = useState(0)
  const sidebarRef = useRef<ScrollBoxRenderable>(null)
  const diffRef = useRef<DiffRenderable>(null)
  const selectedPathRef = useRef<string | undefined>(initialModel.files[0]?.path)
  const previousFilesRef = useRef<ChangedFile[]>(initialModel.files)

  const selectedFile = model.files[selectedIndex]
  const tree = useMemo(() => buildFileTree(model.files), [model.files])
  const treeRows = useMemo(() => flattenTree(tree, expandedDirectories), [expandedDirectories, tree])
  const selectedDiff = useMemo(() => {
    if (selectedFile === undefined) {
      return ""
    }

    return loadFileDiff(model.repoRoot, target, selectedFile)
  }, [model.repoRoot, selectedFile, target])
  const renderedPatch = useMemo(
    () =>
      renderPatch(selectedDiff, {
        full: selectedFile === undefined ? true : fullDiffPaths.has(selectedFile.path),
        maxLines: 1600,
      }),
    [fullDiffPaths, selectedDiff, selectedFile],
  )
  const navigableLines = useMemo(() => renderedPatch.parsed.hunks.flatMap((hunk) => hunk.lines), [renderedPatch])

  function runChecks() {
    setCheckerState(initialCheckerState(model.files))
    void runDiagnostics(model.repoRoot, model.files, (checker, nextState) => {
      setCheckerState((current) => ({ ...current, [checker]: nextState }))
    })
  }

  useEffect(() => {
    runChecks()
    // checks run once on mount, then on demand via "r" (live edits flip badges to pending)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      setModel((previous) => mergeModel(previous, loadGitModel(initialModel.repoRoot, target)))
    }, 750)
    return () => clearInterval(id)
  }, [initialModel.repoRoot, target])

  useEffect(() => {
    const selectedPath = selectedPathRef.current
    if (selectedPath === undefined || model.files[selectedIndex]?.path === selectedPath) {
      return
    }

    const nextIndex = model.files.findIndex((file) => file.path === selectedPath)
    setSelectedIndex(nextIndex >= 0 ? nextIndex : Math.min(selectedIndex, Math.max(0, model.files.length - 1)))
  }, [model.files, selectedIndex])

  useEffect(() => {
    const previousByPath = new Map(previousFilesRef.current.map((file) => [file.path, file]))
    previousFilesRef.current = model.files
    const changed = model.files
      .filter((file) => {
        const before = previousByPath.get(file.path)
        return before === undefined || before.additions !== file.additions || before.deletions !== file.deletions
      })
      .map((file) => file.path)

    if (changed.length > 0) {
      setCheckerState((current) => markPending(current, model.files, changed))
    }
  }, [model.files])

  useEffect(() => {
    if (selectedFile === undefined) {
      return
    }

    const rowIndex = findRowIndexForPath(treeRows, selectedFile.path)
    if (rowIndex >= 0) {
      setFocusedRowIndex(rowIndex)
    }
  }, [selectedFile, treeRows])

  useEffect(() => {
    const focusedRow = treeRows[focusedRowIndex]
    if (focusedRow !== undefined) {
      sidebarRef.current?.scrollChildIntoView(focusedRow.node.id)
    }
  }, [focusedRowIndex, treeRows])

  useEffect(() => {
    const firstChanged = navigableLines.findIndex((line) => line.type !== "context")
    setCursorIndex(firstChanged === -1 ? 0 : firstChanged)
    // reset to the first change only when the file changes, not on live edits of the same file
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile?.path])

  useEffect(() => {
    const diff = diffRef.current
    if (diff === null || navigableLines.length === 0) {
      return
    }

    const last = navigableLines.length - 1
    if (cursorIndex > last) {
      setCursorIndex(last)
      return
    }

    const paint = () => {
      const colors = new Map<number, string | RGBA | LineColorConfig>()
      navigableLines.forEach((line, index) => {
        if (line.type === "add") {
          colors.set(index, { gutter: TRANSPARENT, content: ADDED_BG })
        } else if (line.type === "remove") {
          colors.set(index, { gutter: TRANSPARENT, content: REMOVED_BG })
        }
      })
      colors.set(cursorIndex, { gutter: CURSOR_BG, content: CURSOR_BG })
      diff.setLineColors(colors)
    }

    paint()
    queueMicrotask(paint)

    const rows = Math.max(1, height - 4)
    const pane = diff.findDescendantById(`${DIFF_ID}-left-code`) as ScrollablePane | undefined
    if (pane !== undefined) {
      if (cursorIndex < pane.scrollY) {
        pane.scrollY = cursorIndex
      } else if (cursorIndex >= pane.scrollY + rows) {
        pane.scrollY = cursorIndex - rows + 1
      }
    }

    renderer.requestRender()
  }, [cursorIndex, navigableLines, height, renderer])

  useKeyboard((key) => {
    if (key.name === "q" || key.name === "escape") {
      renderer.destroy()
      return
    }

    if (key.name === "tab") {
      setFocusedPane((current) => (current === "tree" ? "diff" : "tree"))
      return
    }

    if (key.name === "n") {
      const next = nextFindingIndex(model.files, checkerState, selectedIndex)
      if (next !== selectedIndex) {
        selectFile(model.files[next])
      }
      return
    }

    if (key.name === "r") {
      runChecks()
      setStatus("re-running checks")
      return
    }

    if (key.name === "f" && selectedFile !== undefined) {
      setFullDiffPaths((current) => new Set(current).add(selectedFile.path))
      setStatus(`loaded full diff for ${selectedFile.path}`)
      return
    }

    if (key.name === "y" && selectedFile !== undefined) {
      try {
        const line = navigableLines[cursorIndex]
        const reference = line === undefined ? { path: selectedFile.path } : lineReference(selectedFile.path, line)
        copyToClipboard(formatCopyReference(reference))
        setStatus(`copied ${formatCopyReference(reference).split("\n")[0]}`)
      } catch (error) {
        setStatus(error instanceof Error ? error.message : String(error))
      }
      return
    }

    if (focusedPane === "diff") {
      const last = navigableLines.length - 1
      const halfPage = Math.max(1, Math.floor((height - 4) / 2))

      if (key.name === "j" || key.name === "down") {
        setCursorIndex((current) => Math.max(0, Math.min(current + 1, last)))
      } else if (key.name === "k" || key.name === "up") {
        setCursorIndex((current) => Math.max(current - 1, 0))
      } else if (key.ctrl && key.name === "d") {
        setCursorIndex((current) => Math.max(0, Math.min(current + halfPage, last)))
      } else if (key.ctrl && key.name === "u") {
        setCursorIndex((current) => Math.max(current - halfPage, 0))
      } else if (key.name === "g" && !key.shift) {
        setCursorIndex(0)
      } else if (key.name === "g" || key.name === "G") {
        setCursorIndex(Math.max(0, last))
      } else if (key.name === "h" || key.name === "left") {
        setFocusedPane("tree")
      }

      return
    }

    if (key.name === "j" || key.name === "down") {
      moveFocus(1, treeRows, setFocusedRowIndex, selectFile)
      return
    }

    if (key.name === "k" || key.name === "up") {
      moveFocus(-1, treeRows, setFocusedRowIndex, selectFile)
      return
    }

    if (key.name === "l" || key.name === "right") {
      const row = treeRows[focusedRowIndex]
      if (row?.node.type === "directory") {
        setExpandedDirectories((current) => new Set(current).add(row.node.id))
      } else if (row?.node.type === "file") {
        selectFile(row.node.file)
      }
      return
    }

    if (key.name === "h" || key.name === "left") {
      const row = treeRows[focusedRowIndex]
      if (row?.node.type === "directory") {
        setExpandedDirectories((current) => {
          const next = new Set(current)
          next.delete(row.node.id)
          return next
        })
      }
      return
    }

    if (key.name === "return") {
      const row = treeRows[focusedRowIndex]
      if (row !== undefined) {
        const file = firstFileInNode(row.node)
        if (file !== undefined) {
          selectFile(file)
        }
      }
    }
  })

  function selectFile(file: ChangedFile | undefined) {
    if (file === undefined) {
      return
    }

    const nextIndex = model.files.findIndex((candidate) => candidate.path === file.path)
    if (nextIndex >= 0) {
      selectedPathRef.current = file.path
      setSelectedIndex(nextIndex)
      setExpandedDirectories((current) => expandAncestorsForPath(current, file.path))
    }
  }

  if (model.files.length === 0) {
    return (
      <box width="100%" height="100%" flexDirection="column" padding={1} backgroundColor="#09090b">
        <text fg="#ff4fb8">ojo</text>
        <text fg="#a1a1aa">No changes found for this comparison.</text>
        <text fg="#71717a">q exits</text>
      </box>
    )
  }

  const sidebarWidth = Math.max(34, Math.min(54, Math.floor(width * 0.34)))
  const cursorLine = navigableLines[cursorIndex]
  const cursorLineNumber = cursorLine?.newLine ?? cursorLine?.oldLine

  return (
    <box width="100%" height="100%" flexDirection="column" backgroundColor="#09090b">
      <box height={1} flexDirection="row" justifyContent="space-between" paddingLeft={1} paddingRight={1} backgroundColor="#111113">
        <text fg="#ff4fb8">ojo</text>
        <text fg="#a1a1aa">
          {target.kind === "staged" ? `staged vs ${target.ref}` : `worktree vs ${target.ref}`} · {model.files.length} files
        </text>
      </box>
      <box flexGrow={1} flexDirection="row">
        <box width={sidebarWidth} height="100%" flexDirection="column" borderStyle="single" borderColor={focusedPane === "tree" ? "#ff4fb8" : "#27272a"}>
          <scrollbox ref={sidebarRef} width="100%" height={Math.max(1, height - 4)} scrollY viewportCulling>
            {treeRows.map((row) => (
              <box key={row.node.id} id={row.node.id} width="100%" flexDirection="column" paddingLeft={1} paddingRight={1} backgroundColor={row.index === focusedRowIndex ? "#3a1530" : "#09090b"}>
                <text fg={row.index === focusedRowIndex ? "#ffffff" : "#d4d4d8"}>{treeRowLabel(row, expandedDirectories, selectedFile)}</text>
                <box flexDirection="row">
                  {row.node.type === "file" ? <text fg={stageColor(row.node.file.stage)}>{stageLabel(row.node.file.stage)} </text> : null}
                  <text fg={row.index === focusedRowIndex ? "#f5a3d7" : "#71717a"}>{describeTreeNode(row.node, checkerState)}</text>
                </box>
              </box>
            ))}
          </scrollbox>
        </box>
        <box flexGrow={1} height="100%" flexDirection="column" borderStyle="single" borderColor={focusedPane === "diff" ? "#ff4fb8" : "#27272a"}>
          <box height={1} flexDirection="row" justifyContent="space-between" paddingLeft={1} paddingRight={1}>
            <text fg="#e4e4e7">{selectedFile === undefined ? "" : `${selectedFile.path}  +${selectedFile.additions} -${selectedFile.deletions}`}</text>
            <text fg="#71717a">{cursorLineNumber === undefined ? "" : `ln ${cursorLineNumber}`}</text>
          </box>
          <diff
            id={DIFF_ID}
            ref={diffRef}
            key={`${selectedFile?.path ?? "empty"}:${selectedFile === undefined ? "full" : fullDiffPaths.has(selectedFile.path)}`}
            width="100%"
            height={Math.max(1, height - 4)}
            diff={renderedPatch.diff}
            view="unified"
            filetype={selectedFile === undefined ? "text" : diffFiletypeFor(selectedFile.path, syntax)}
            syntaxStyle={syntax.enabled ? syntax.style : undefined}
            treeSitterClient={syntax.enabled ? syntax.treeSitterClient : undefined}
            showLineNumbers
            wrapMode="none"
            addedBg="#102a1c"
            removedBg="#32131f"
            addedSignColor="#3ddc84"
            removedSignColor="#ff5c8a"
            lineNumberFg="#71717a"
          />
        </box>
      </box>
      <box height={1} flexDirection="row" justifyContent="space-between" paddingLeft={1} paddingRight={1} backgroundColor="#111113">
        <text fg="#71717a">
          {focusedPane === "diff" ? "j/k cursor · ctrl-d/u page · g/G ends · y copy · tab/h files · q quit" : "j/k file · h/l fold · tab diff · y copy · n next · q quit"}
        </text>
        <text fg="#a1a1aa">{renderedPatch.truncated ? `${status} · large diff truncated; f for full` : status}</text>
      </box>
    </box>
  )
}

function stageLabel(stage: StageState) {
  if (stage === "untracked") {
    return "new"
  }

  return stage
}

function stageColor(stage: StageState) {
  if (stage === "staged") {
    return "#3ddc84"
  }

  if (stage === "unstaged") {
    return "#fbbf24"
  }

  if (stage === "mixed") {
    return "#fb923c"
  }

  return "#a1a1aa"
}

function kindGlyph(kind: ChangedFile["kind"]) {
  if (kind === "untracked" || kind === "added") {
    return "+"
  }

  if (kind === "deleted") {
    return "-"
  }

  if (kind === "renamed") {
    return ">"
  }

  return "~"
}

function treeGlyph(node: FileTreeNode, expandedDirectories: Set<string>) {
  if (node.type === "file") {
    return kindGlyph(node.file.kind)
  }

  return expandedDirectories.has(node.id) ? "v" : ">"
}

function treeRowLabel(row: FileTreeRow, expandedDirectories: Set<string>, selectedFile: ChangedFile | undefined) {
  const selected = row.node.type === "file" && selectedFile?.path === row.node.path ? "*" : " "
  const indent = " ".repeat(Math.max(0, row.node.depth) * 2)
  const suffix = row.node.type === "directory" ? "/" : ""
  return `${selected}${indent}${treeGlyph(row.node, expandedDirectories)} ${row.node.name}${suffix}`
}

function nextFindingIndex(files: ChangedFile[], checkerState: CheckerState, selectedIndex: number) {
  for (let offset = 1; offset <= files.length; offset += 1) {
    const index = (selectedIndex + offset) % files.length
    const file = files[index]
    if (file !== undefined && fileHasFindings(file.path, checkerState)) {
      return index
    }
  }

  return selectedIndex
}

function moveFocus(direction: -1 | 1, rows: FileTreeRow[], setFocusedRowIndex: (updater: (current: number) => number) => void, selectFile: (file: ChangedFile | undefined) => void) {
  setFocusedRowIndex((current) => {
    const next = Math.max(0, Math.min(current + direction, rows.length - 1))
    const row = rows[next]
    if (row?.node.type === "file") {
      selectFile(row.node.file)
    }
    return next
  })
}
