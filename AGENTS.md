# Agent Instructions

## Product

`ojo` is a terminal-first glance tool for reviewing what an AI coding agent just changed. The human stays in charge: the tool helps inspect robot output, but it never reviews, explains, approves, rejects, gates, or talks back to an agent.

The core loop is:

1. Glance at the changed-file map.
2. Drill into a suspicious diff.
3. Copy a `path:line:column` reference plus snippet.
4. Paste that reference into the agent conversation and redirect in your own words.

## Technical Defaults

- Use Bun for runtime, scripts, dependency management, test commands, and build smoke checks.
- Use TypeScript with `strict` enabled.
- Use `@opentui/core` and `@opentui/react` for the terminal UI.
- Configure JSX with `jsxImportSource: "@opentui/react"`.
- Treat git output as the synchronous source of truth.
- Render the git-backed file map before any checker or diagnostic process resolves.
- Run diagnostics as independent async decorations over the stable git file list.
- Keep v1 macOS-first for clipboard support with `pbcopy`.

## Local Skills

Project skills are installed under `.agents/skills`.

- Use `.agents/skills/find-skills/SKILL.md` when discovering additional skills.
- Use `.agents/skills/bun/SKILL.md` before changing dependencies, scripts, tests, runtime behavior, or build commands.
- Use `.agents/skills/opentui/SKILL.md` before writing or changing OpenTUI code.
- For OpenTUI React work, start with `.agents/skills/opentui/docs/bindings/react.mdx`, then read component docs such as `docs/components/diff.mdx`, `docs/components/select.mdx`, `docs/components/scrollbox.mdx`, `docs/components/box.mdx`, and `docs/components/text.mdx` as needed.
- For keyboard/navigation behavior, read `.agents/skills/opentui/docs/core-concepts/keyboard.mdx` and `.agents/skills/opentui/docs/keymap/overview.mdx`.
- For testing OpenTUI behavior, read `.agents/skills/opentui/docs/core-concepts/testing.mdx`.

## Coding Conventions

- Prefer `bun run`, `bun test`, `bun install`, `bun add`, `bun add -d`, `bun remove`, and `bun build`; do not introduce Node/npm/Jest/esbuild wrappers unless explicitly requested.
- Put Bun runtime flags before `run`, such as `bun --watch run <script>`.
- Keep `bun.lock` text lockfile changes with dependency changes.
- Do not rely on transitive dependencies; declare direct dependencies in `package.json`.
- Use `===` and `!==`; never use `== null` or `!= null`.
- Avoid explicit return type annotations on functions unless needed for exported API clarity, recursion, overloads, or type inference limits.
- Prefer small typed modules for git parsing, diagnostics, clipboard, CLI args, and UI state.
- Prefer structured parsing over ad hoc string manipulation when a command offers machine-readable output.
- Keep comments sparse and useful; do not narrate obvious code.
- Do not add AI-generated sign-offs to commits, PR text, docs, or generated content.

## Implementation Guardrails

- `ojo [ref]` defaults to working tree vs `HEAD`.
- `ojo --staged` compares staged changes.
- The tool must work in any git repo, not only this repo or agent-created worktrees.
- Include untracked files in the file map and render them as all-added diffs.
- Tag each file as staged, unstaged, mixed, or untracked from `git status` and show it in the map.
- The view is live: poll git and refresh the file map and diff while the user watches.
- Compute file ordering at first paint and preserve it across live refreshes; new files append and removed files drop, so the list never reorders under the cursor.
- Preserve the user's selection and diff cursor across refreshes; reset the cursor only on file switch.
- Late diagnostics must fill badges in place and never reorder the list.
- Checker badges must use explicit states: `pending`, `clean`, `findings`, and `failed` when needed.
- Missing or empty diagnostics must never render as clean; a file that changes returns its badges to `pending` until checks re-run.
- Diagnostics run on demand: once at startup and when the user presses `r`. New-vs-baseline diagnostics are deferred.
- Do not implement an LSP client, web preview, PR workflow, accept/reject protocol, or agent integration in v1.

## Verification

- Use Bun commands for local checks.
- Use `bun run check` as the default pre-submit command.
- Use `bun run build` as the Bun compile smoke check.
- Use `bun run src/main.tsx --help` as the CLI smoke check.
- Run `bun install` after package or lockfile changes.
- Add focused tests for git parsing, CLI argument handling, diagnostic parsing, checker state transitions, and copy-reference formatting.
- Keep OpenTUI rendering tests separate from pure parsing/state tests where practical.
