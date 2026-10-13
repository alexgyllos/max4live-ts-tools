/** In-memory entrypoint: no Node filesystem imports. */
export type * from "./types.js";
export * from "./errors.js";
export {
  parsePatch,
  parsePatchObject,
  serializePatch,
  toPatchObject,
} from "./io/parse.js";
export { stableStringify } from "./io/serializer.js";
export { validateGraph } from "./validate/graph.js";

export { PatchEditor } from "./editor/patch-editor.js";
export { PatchBuilder } from "./editor/patch-builder.js";
export type {
  BoxQuery,
  MatchOptions,
  PatcherPath,
} from "./editor/patch-editor.js";
export type { BuilderOptions, ObjectOptions } from "./editor/patch-builder.js";
export { walkPatch, queryPatch } from "./nested.js";
export type { PatchScope } from "./nested.js";

export { diffPatches } from "./diff.js";
export type { DiffChange, PatchDiff } from "./diff.js";
