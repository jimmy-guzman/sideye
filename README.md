# ojo

A terminal tool for reviewing what an AI coding agent just changed — fast enough that you never
reach for a diff viewer or a draft PR.

Most "AI diff" tools point the arrow one way: the robot explains its own work. `ojo` points it the
other way — you render judgment on the robot's output and keep it honest. It shows the changed-file
map and the diffs, then hands you a `path:line` + snippet to paste back and redirect the agent. It
never reviews, explains, approves, or talks back to an agent.

## Use it

```sh
bun install
bun run src/main.tsx            # working tree vs HEAD
bun run src/main.tsx <ref>      # compare against a ref
bun run src/main.tsx --staged   # staged changes only
```

The view is **live**: the file map and diff refresh while the agent edits. Each file is tagged
`staged` / `unstaged` / `mixed` / `new`.

## Keys

```
tab          switch focus between the file list and the diff
j / k        file list: move between files · diff: move the cursor line
h / l        fold / expand folders · h also leaves the diff
ctrl-d / u   diff: jump a half page    g / G: first / last line
y            copy path:line + snippet at the cursor
n            jump to the next file with findings
r            re-run checks
f            load a truncated diff in full
q            quit
```

## Requirements

- [Bun](https://bun.sh) — runtime, test runner, and package manager
- macOS for clipboard copy (`pbcopy`)
