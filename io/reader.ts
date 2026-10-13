import * as fs from "node:fs";
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
  let fd: number | undefined;
  let bytes: Buffer;
  try {
    fd = fs.openSync(source, "r");
    const maxBytes = 40 * 1024 * 1024;
    if (fs.fstatSync(fd).size > maxBytes)
      throw new Error("Input exceeds 40 MiB UTF-8 byte limit");
    const chunks: Buffer[] = [];
    let total = 0;
    while (true) {
      const chunk = Buffer.allocUnsafe(Math.min(65536, maxBytes - total + 1));
      const count = fs.readSync(fd, chunk, 0, chunk.length, null);
      if (!count) break;
      total += count;
      if (total > maxBytes)
        throw new Error("Input exceeds 40 MiB UTF-8 byte limit");
      chunks.push(chunk.subarray(0, count));
    }
    bytes = Buffer.concat(chunks, total);
    fs.closeSync(fd);
    fd = undefined;
  } catch (cause) {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch (cleanup) {
        cause = new AggregateError([cause, cleanup], "Read and close failures");
      }
    }
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
