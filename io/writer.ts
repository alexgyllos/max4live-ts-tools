import { serializePatch } from "./parse.js";
import { writeAtomicFile } from "./atomic-file.js";
import type { NormalizedPatch, WriteOptions } from "../types.js";
export { serializePatch } from "./parse.js";
/** Synchronous temporary-file replacement; Windows rename retries can wait 560 ms. */
export function writeFile(
  filePath: string,
  patch: NormalizedPatch,
  options?: WriteOptions,
): void {
  writeAtomicFile(filePath, serializePatch(patch, options));
}
