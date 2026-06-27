import { afterEach, expect, test } from "bun:test";

import { batch } from "solid-js";

import type { GitModel } from "../src/git/model";
import { state } from "../src/state";

function modelWith(paths: string[]): GitModel {
  return {
    changed: [],
    changedByPath: new Map(),
    repoFiles: paths.map((path) => ({ path, symlink: false, tracked: true })),
    repoFilesKey: "k",
    repoRoot: "/x",
    scopeKey: "all:HEAD",
  };
}

function seed(paths: string[]) {
  batch(() => {
    state.setChangesOnly(false);
    state.setExpandedDirectories(new Set<string>());
    state.setGitModel(modelWith(paths));
    state.setFocusedNodeId(`file:${paths[0]}`);
    state.seedNav(undefined);
  });
}

afterEach(() => {
  batch(() => {
    state.setGitModel(modelWith([]));
    state.setExpandedDirectories(new Set<string>());
    state.setFocusedNodeId("");
    state.seedNav(undefined);
  });
});

test("selectFile builds history that goBack and goForward walk", () => {
  seed(["a.ts", "b.ts", "c.ts"]);
  state.selectFile("a.ts");
  state.selectFile("b.ts");
  state.selectFile("c.ts");
  expect(state.selectedPath()).toBe("c.ts");
  expect(state.canGoBack()).toBe(true);
  expect(state.canGoForward()).toBe(false);

  state.goBack();
  expect(state.selectedPath()).toBe("b.ts");
  expect(state.canGoForward()).toBe(true);

  state.goBack();
  expect(state.selectedPath()).toBe("a.ts");
  expect(state.canGoBack()).toBe(false);

  state.goForward();
  expect(state.selectedPath()).toBe("b.ts");
});

test("opening a file after going back truncates the forward history", () => {
  seed(["a.ts", "b.ts", "c.ts", "d.ts"]);
  state.selectFile("a.ts");
  state.selectFile("b.ts");
  state.selectFile("c.ts");

  state.goBack();
  expect(state.selectedPath()).toBe("b.ts");

  state.selectFile("d.ts");
  expect(state.selectedPath()).toBe("d.ts");
  expect(state.canGoForward()).toBe(false);
  state.goBack();
  expect(state.selectedPath()).toBe("b.ts");
});

test("consecutive tree browsing collapses to one history entry", () => {
  seed(["a.ts", "b.ts", "c.ts"]);
  state.selectFile("a.ts");
  state.moveFocus(1);
  state.moveFocus(1);
  expect(state.selectedPath()).toBe("c.ts");

  state.goBack();
  expect(state.selectedPath()).toBe("a.ts");
  expect(state.canGoBack()).toBe(false);
});

test("goBack enqueues a pendingRestore for the target path", () => {
  seed(["a.ts", "b.ts"]);
  state.selectFile("a.ts");
  state.selectFile("b.ts");
  expect(state.pendingRestore()?.path).toBe("b.ts");

  state.goBack();
  expect(state.pendingRestore()?.path).toBe("a.ts");
});

test("goBack and goForward are no-ops at the ends of history", () => {
  seed(["a.ts", "b.ts"]);
  state.selectFile("a.ts");
  state.goBack();
  expect(state.selectedPath()).toBe("a.ts");
  state.goForward();
  expect(state.selectedPath()).toBe("a.ts");
});
