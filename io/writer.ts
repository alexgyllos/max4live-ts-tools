import { serializePatch } from "./parse.js";
import { writeAtomicFile } from "./atomic-file.js";
import type { NormalizedPatch, FileWriteOptions } from "../types.js";
export { serializePatch } from "./parse.js";
/** Synchronous temporary-file replacement; Windows rename retries can wait 560 ms. */
export function writeFile(
  filePath: string,
  patch: NormalizedPatch,
  options?: FileWriteOptions,
): void {
  writeAtomicFile(filePath, serializePatch(patch, options), options);
}
