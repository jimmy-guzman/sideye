import { Atom } from "effect/unstable/reactivity"

export const changesOnlyAtom = Atom.make(false)
export const selectedPathAtom = Atom.make<string | undefined>(undefined)
export const expandedDirectoriesAtom = Atom.make(new Set<string>())
