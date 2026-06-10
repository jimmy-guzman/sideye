import { describe, expect, test } from "bun:test"
import { initialCheckerState, parseEslintJson, parsePrettierList, parseTypeScriptOutput, runDiagnostics } from "../src/diagnostics"
import type { ChangedFile } from "../src/git"

const file: ChangedFile = {
  path: "src/a.ts",
  kind: "modified",
  stage: "unstaged",
  additions: 1,
  deletions: 0,
  binary: false,
  warnings: [],
  sortIndex: 0,
}

describe("initialCheckerState", () => {
  test("starts every checker as pending", () => {
    const state = initialCheckerState([file])
    expect(state.lint.get("src/a.ts")?.status).toBe("pending")
    expect(state.prettier.get("src/a.ts")?.status).toBe("pending")
    expect(state.typecheck.get("src/a.ts")?.status).toBe("pending")
  })
})

describe("diagnostic parsers", () => {
  test("parses eslint json", () => {
    const diagnostics = parseEslintJson({
      stdout: JSON.stringify([{ filePath: "src/a.ts", messages: [{ line: 3, severity: 2, message: "bad" }] }]),
    })
    expect(diagnostics).toEqual([{ checker: "lint", path: "src/a.ts", line: 3, severity: "error", message: "bad" }])
  })

  test("parses prettier list output", () => {
    expect(parsePrettierList({ stdout: "Checking formatting...\nsrc/a.ts\n" })).toEqual([
      { checker: "prettier", path: "src/a.ts", severity: "warning", message: "Formatting differs from Prettier" },
    ])
  })

  test("parses TypeScript diagnostics", () => {
    expect(parseTypeScriptOutput({ stdout: "src/a.ts(4,12): error TS2322: nope", stderr: "" })).toEqual([
      { checker: "typecheck", path: "src/a.ts", line: 4, severity: "error", message: "nope" },
    ])
  })
})

describe("runDiagnostics", () => {
  test("missing checkers resolve as failed instead of clean", async () => {
    const states: string[] = []
    await runDiagnostics("/tmp", [file], (_checker, state) => {
      states.push(state.get("src/a.ts")?.status ?? "missing")
    })
    expect(states).toEqual(["failed", "failed", "failed"])
  })
})
