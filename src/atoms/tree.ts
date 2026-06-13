import { Atom } from "effect/unstable/reactivity"
import { buildFileTree, flattenTree } from "../tree"
import { gitModelAtom } from "./git"
import { changesOnlyAtom, expandedDirectoriesAtom } from "./ui"

const treeAtom = Atom.make((get) => {
  const model = get(gitModelAtom)
  const changesOnly = get(changesOnlyAtom)
  if (model === undefined) {
    return []
  }

  return buildFileTree(model.repoFiles, model.changedByPath, { changesOnly })
})

export const treeRowsAtom = Atom.make((get) => flattenTree(get(treeAtom), get(expandedDirectoriesAtom)))
