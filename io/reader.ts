import { readBytes } from "./read-bytes.js";
import { resolve } from "node:path";
import { MaxpatParseError } from "../errors.js";
import { parsePatch } from "./parse.js";
import type { ReadOptions, NormalizedPatch } from "../types.js";
/** Bounded UTF-8 adapter; a source growing during the read cannot allocate unbounded memory. */
export function readFile(
  filePath: string,
  options?: ReadOptions,
): NormalizedPatch {
  const source = resolve(filePath);
  let bytes: Uint8Array;
  try {
    bytes = readBytes(source, 40 * 1024 * 1024);
  } catch (cause) {
    throw new MaxpatParseError(
      "Could not read bounded UTF-8 file",
      source,
      cause,
    );
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (e) {
    throw new MaxpatParseError("Could not decode UTF-8 file", source, e);
  }
  return parsePatch(text, options, source);
}
