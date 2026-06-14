import { expect, test } from "bun:test"
import { state } from "../src/state"

test("recencyByPath maps each path to its last activity timestamp", () => {
  state.setActivityLog({
    events: [
      { at: 1000, kind: "changed", path: "a.txt" },
      { at: 2000, kind: "changed", path: "a.txt" },
      { at: 1500, kind: "appeared", path: "b.txt" },
    ],
  })

  const recency = state.recencyByPath()
  expect(recency.get("a.txt")).toBe(2000)
  expect(recency.get("b.txt")).toBe(1500)
})
