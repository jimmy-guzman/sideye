/**
 * On-demand read-only code-intelligence pulls (`textDocument/definition`,
 * `textDocument/references`) over the warm `LanguageServers` pool. Each call is a one-shot
 * open/request/close bracket on the first acquired server that advertises the needed capability
 * (oxlint, which advertises none, drops out; typescript answers). The seam the diagnostics push
 * flow lacks; #130/#131.
 */
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { Context, Data, Effect, Layer } from "effect";

import { relativize } from "../diagnostics/checker";
import { LanguageServers, lspLanguageId, serversForPath } from "../diagnostics/servers";
import type { Capability, ServerHandle } from "../diagnostics/servers";
import { normalizeDefinition, normalizeReferences } from "./protocol";
import type { NormalizedLocation } from "./protocol";

/** A code-intel request that failed past degradation (server error, dropped connection, timeout). */
export class IntelRequestError extends Data.TaggedError("IntelRequestError")<{
  readonly method: string;
  readonly message: string;
}> {}

interface Position {
  line: number;
  character: number;
}

export class Intel extends Context.Service<
  Intel,
  {
    readonly definition: (
      repoRoot: string,
      path: string,
      position: Position,
    ) => Effect.Effect<NormalizedLocation[], IntelRequestError>;
    readonly references: (
      repoRoot: string,
      path: string,
      position: Position,
    ) => Effect.Effect<NormalizedLocation[], IntelRequestError>;
  }
>()("sideye/Intel") {}

export const IntelLive = Layer.effect(
  Intel,
  Effect.gen(function* intelLive() {
    const servers = yield* LanguageServers;

    // The first server for this file that advertises the capability. Acquire failures
    // (unavailable/installing/spawn) skip that server rather than failing the pull.
    function firstCapableServer(repoRoot: string, path: string, capability: Capability) {
      return Effect.gen(function* select() {
        for (const language of serversForPath(path)) {
          const handle = yield* servers
            .acquire(language, repoRoot)
            .pipe(Effect.catch(() => Effect.succeed<ServerHandle | undefined>(undefined)));
          if (handle !== undefined && handle.capabilities.has(capability)) {
            return handle;
          }
        }
        return undefined;
      });
    }

    function pull(
      repoRoot: string,
      path: string,
      position: Position,
      capability: Capability,
      method: string,
      extraParams: Record<string, unknown>,
      normalize: (reply: unknown) => NormalizedLocation[],
    ) {
      return Effect.scoped(
        Effect.gen(function* request() {
          const handle = yield* firstCapableServer(repoRoot, path, capability);
          if (handle === undefined) {
            return [];
          }
          const absolute = join(repoRoot, path);
          // A file deleted between the caret read and this pull can't be opened; degrade to empty.
          const text = yield* Effect.promise(() =>
            Bun.file(absolute)
              .text()
              .catch(() => undefined),
          );
          if (text === undefined) {
            return [];
          }
          const uri = pathToFileURL(absolute).href;
          yield* handle.connection.notify("textDocument/didOpen", {
            textDocument: { languageId: lspLanguageId(path), text, uri, version: 1 },
          });
          const reply = yield* handle.connection
            .request(method, { position, textDocument: { uri }, ...extraParams })
            .pipe(
              Effect.timeout("5 seconds"),
              Effect.catchTag("TimeoutError", () =>
                Effect.fail(new IntelRequestError({ message: "timed out", method })),
              ),
              Effect.catchTag("LspRequestError", (error) =>
                Effect.fail(new IntelRequestError({ message: error.message, method })),
              ),
              // Close the document even when the request times out or the fiber is interrupted.
              Effect.ensuring(
                handle.connection.notify("textDocument/didClose", { textDocument: { uri } }),
              ),
            );
          // The reply's paths are absolute; the tree/viewer key off repo-relative paths (a target
          // Outside the repo stays absolute, so the caller can detect and skip it).
          return normalize(reply).map((location) => ({
            column: location.column,
            line: location.line,
            path: relativize(location.path, repoRoot),
          }));
        }),
      );
    }

    return {
      definition: (repoRoot, path, position) =>
        pull(
          repoRoot,
          path,
          position,
          "definition",
          "textDocument/definition",
          {},
          normalizeDefinition,
        ),
      references: (repoRoot, path, position) =>
        pull(
          repoRoot,
          path,
          position,
          "references",
          "textDocument/references",
          { context: { includeDeclaration: true } },
          normalizeReferences,
        ),
    };
  }),
);
