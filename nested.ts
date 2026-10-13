import { toPatchObject, parsePatchObject } from "./io/parse.js";
import type { NormalizedPatch } from "./types.js";
import {
  PatchEditor,
  type BoxQuery,
  type PatcherPath,
} from "./editor/patch-editor.js";
export type PatchScope = { path: PatcherPath; patch: NormalizedPatch };
/** Preorder, array-order traversal. IDs are local to each path; references are never loaded. */
export function* walkPatch(patch: NormalizedPatch): Generator<PatchScope> {
  const raw = toPatchObject(patch, { skipValidation: true });
  function* visit(
    patcher: typeof raw.patcher,
    path: string[],
  ): Generator<PatchScope> {
    yield {
      path: [...path],
      patch: parsePatchObject(path.length ? { patcher } : raw),
    };
    for (const { box } of patcher.boxes)
      if (box.patcher) yield* visit(box.patcher, [...path, box.id]);
  }
  yield* visit(raw.patcher, []);
}
export function queryPatch(patch: NormalizedPatch, query: BoxQuery = {}) {
  return [...walkPatch(patch)].flatMap((scope) =>
    PatchEditor.fromNormalized(scope.patch)
      .find(query)
      .map((box) => ({ path: [...scope.path], box })),
  );
}
