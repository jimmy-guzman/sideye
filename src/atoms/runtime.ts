import { Layer } from "effect"
import { Atom } from "effect/unstable/reactivity"
import { DiagnosticsLive } from "../services/diagnostics"
import { GitLive } from "../services/git"
import { ProcessLive } from "../services/process"

// Shared runtime for effect-backed atoms; holds the service layer so atoms built
// With runtime.fn / runtime.atom can reach Git, Diagnostics, and the Process they
// Compose over.
const AppLayer = Layer.mergeAll(DiagnosticsLive, GitLive).pipe(Layer.provide(ProcessLive))

export const runtime = Atom.runtime(AppLayer)
