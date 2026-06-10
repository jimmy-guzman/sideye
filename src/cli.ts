export type DiffTarget =
  | { kind: "worktree"; ref: string }
  | { kind: "staged"; ref: string }

export type CliOptions = {
  target: DiffTarget
  help: boolean
  version: boolean
}

export function parseArgs(args: string[]): CliOptions {
  let staged = false
  let help = false
  let version = false
  let ref: string | undefined

  for (const arg of args) {
    if (arg === "--staged") {
      staged = true
      continue
    }

    if (arg === "--help" || arg === "-h") {
      help = true
      continue
    }

    if (arg === "--version" || arg === "-v") {
      version = true
      continue
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`)
    }

    if (ref !== undefined) {
      throw new Error(`Unexpected argument: ${arg}`)
    }

    ref = arg
  }

  const baseRef = ref ?? "HEAD"

  return {
    help,
    version,
    target: staged ? { kind: "staged", ref: baseRef } : { kind: "worktree", ref: baseRef },
  }
}

export function helpText() {
  return `ojo - terminal glance review for git diffs

Usage:
  ojo
  ojo <ref>
  ojo --staged [ref]

Keys:
  tab        switch focus between the file list and the diff

File list:
  j/down     next file
  k/up       previous file
  h/left     collapse folder
  l/right    expand folder
  enter      open focused tree item

Diff:
  j/down     move cursor down a line
  k/up       move cursor up a line
  ctrl-d/u   move cursor half a page
  g/G        jump to first / last line
  h/left     return focus to the file list

Anywhere:
  f          load full diff when truncated
  y          copy path:line + snippet at the cursor
  n          jump to next file with findings
  r          re-run checks
  q/escape   quit

The view is live: the file map and diff refresh as files change. Each file is
tagged staged / unstaged / mixed / new.
`
}
