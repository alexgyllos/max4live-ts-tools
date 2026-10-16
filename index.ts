// Public API — only import from this barrel outside this package

// Types
export type {
  Rect,
  PatchlineEndpoint,
  Severity,
  Diagnostic,
  DiagnosticLocation,
  ValidationResult,
  NormalizedPatch,
  NormalizedBox,
  NormalizedLine,
  PatcherMeta,
  RuleConfig,
  RuleOverride,
  CustomRule,
  ReadOptions,
  WriteOptions,
  FileWriteOptions,
  BoxSpec,
  BoxUpdate,
} from "./types.js";

// Errors
export {
  MaxpatParseError,
  MaxpatStructuralError,
  MaxpatValidationError,
  MaxpatWriteError,
} from "./errors.js";

// IO
export {
  readFile,
  writeFile,
  serializePatch,
  stableStringify,
} from "./io/index.js";

// Validation
export { validateGraph } from "./validate/graph.js";

// Editor
export { PatchEditor, PatchBuilder } from "./editor/index.js";

export { parsePatch, parsePatchObject, toPatchObject } from "./io/parse.js";

export { MaxpatEditError } from "./errors.js";
export type {
  BoxQuery,
  MatchOptions,
  PatcherPath,
  BuilderOptions,
  ObjectOptions,
  CommonObjectName,
  CommonObjectOptions,
} from "./editor/index.js";
export { walkPatch, queryPatch } from "./nested.js";
export type { PatchScope } from "./nested.js";

export { diffPatches } from "./diff.js";
export type { DiffChange, PatchDiff } from "./diff.js";

export { AmxdError, decodeAmxd, encodeAmxd } from "./amxd/codec.js";
export type {
  AmxdDevice,
  AmxdDeviceType,
  AmxdContainer,
  AmxdChunk,
} from "./amxd/codec.js";
export { readAmxd, writeAmxd } from "./amxd/files.js";
export { createMaxForLiveDevice } from "./amxd/template.js";
export { addLiveParameter } from "./amxd/parameters.js";
export type { LiveDialAppearance } from "./amxd/presentation.js";
export { applyNativePresentation } from "./amxd/presentation.js";
export type { LiveParameterOptions } from "./amxd/parameters.js";
