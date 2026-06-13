import { Atom } from "effect/unstable/reactivity"
import type { GitModel } from "../git"

// Holds the live git model. Undefined until the first poll lands; App falls back
// To the initial model passed at startup so the first frame is never empty.
export const gitModelAtom = Atom.make<GitModel | undefined>(undefined)
