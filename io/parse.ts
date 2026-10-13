import { MaxpatParseError, MaxpatValidationError } from "../errors.js";
import { parseStructural } from "../validate/structural.js";
import { normalize } from "../normalize/normalize.js";
import { denormalize } from "../normalize/denormalize.js";
import { validateGraph } from "../validate/graph.js";
import { stableStringify } from "./serializer.js";
import type { NormalizedPatch, ReadOptions, WriteOptions } from "../types.js";
/** UTF-8 JSON text (optional leading BOM). Graph checking is opt-in when parsing. */
export function parsePatch(
  text: string,
  options?: ReadOptions,
  source = "<memory>",
): NormalizedPatch {
  if (typeof text !== "string" || text.length > 20 * 1024 * 1024)
    throw new MaxpatParseError("Expected JSON text at most 20 MiB", source);
  let raw: unknown;
  try {
    raw = JSON.parse(text.startsWith("\uFEFF") ? text.slice(1) : text);
  } catch (e) {
    throw new MaxpatParseError("Invalid JSON", source, e);
  }
  return parsePatchObject(raw, options, source);
}
/** Owns the input; rejects ambiguous IDs at every embedded patcher scope. */
export function parsePatchObject(
  raw: unknown,
  options?: ReadOptions,
  source = "<memory>",
): NormalizedPatch {
  const data = parseStructural(raw, source);
  const checkDuplicates = (
    patcher: typeof data.patcher,
    path: string[] = [],
  ): void => {
    if (path.length > 24)
      throw new MaxpatParseError("Embedded patcher depth exceeds 24", source);
    const seen = new Set<string>();
    for (const { box } of patcher.boxes) {
      if (seen.has(box.id))
        throw new MaxpatValidationError("Duplicate box IDs", [
          {
            severity: "error",
            code: "E001",
            message: `duplicate box id ${box.id}`,
            location: { boxId: box.id, path: JSON.stringify(path) },
          },
        ]);
      seen.add(box.id);
      if (box.patcher) checkDuplicates(box.patcher, [...path, box.id]);
    }
  };
  checkDuplicates(data.patcher);
  const patch = normalize(data);
  if (options?.validateGraph) {
    const r = validateGraph(patch, options.ruleConfig, options.customRules);
    if (!r.ok)
      throw new MaxpatValidationError(
        "Patch has validation errors",
        r.diagnostics,
      );
  }
  return patch;
}
export function toPatchObject(patch: NormalizedPatch, options?: WriteOptions) {
  const raw = denormalize(patch);
  // Reuse duplicate checks recursively; structural checks are never optional.
  parsePatchObject(raw);
  if (!options?.skipValidation) {
    const r = validateGraph(patch, options?.ruleConfig, options?.customRules);
    if (!r.ok)
      throw new MaxpatValidationError(
        "Cannot output patch with validation errors",
        r.diagnostics,
      );
  }
  return raw;
}
export const serializePatch = (
  patch: NormalizedPatch,
  options?: WriteOptions,
): string => stableStringify(toPatchObject(patch, options)) + "\n";
