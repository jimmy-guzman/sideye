import { expect, test } from "bun:test";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { Effect } from "effect";

import { File, FileLive } from "../src/services/file";
import { ProcessLive } from "../src/services/process";
import { createFixtureRepo, runGit } from "./helpers";

function loadGitShow(repo: string, path: string) {
  return Effect.runPromise(
    File.pipe(
      Effect.flatMap((file) => file.content(repo, path, { full: false, gitSpec: `HEAD:${path}` })),
      Effect.provide(FileLive),
      Effect.provide(ProcessLive),
    ),
  );
}

test("File.content classifies a deleted binary file from git-show as binary", async () => {
  const repo = createFixtureRepo("file-service-binary-", { "keep.txt": "x\n" });
  try {
    writeFileSync(join(repo, "logo.bin"), Buffer.from([0x89, 0x50, 0x00, 0x47]));
    runGit(repo, ["add", "logo.bin"]);
    runGit(repo, ["commit", "-m", "add binary"]);
    runGit(repo, ["rm", "logo.bin"]);

    expect(await loadGitShow(repo, "logo.bin")).toEqual({ kind: "binary" });
  } finally {
    rmSync(repo, { force: true, recursive: true });
  }
});

test("File.content decodes a deleted text file from git-show", async () => {
  const repo = createFixtureRepo("file-service-text-", { "note.txt": "hello\nworld\n" });
  try {
    runGit(repo, ["rm", "note.txt"]);

    expect(await loadGitShow(repo, "note.txt")).toEqual({
      content: "hello\nworld",
      kind: "text",
      lineCount: 2,
      truncated: false,
    });
  } finally {
    rmSync(repo, { force: true, recursive: true });
  }
});
