import { resolve } from "node:path";
import { readBytes } from "../io/read-bytes.js";
import { writeAtomicFile } from "../io/atomic-file.js";
import { AmxdError, decodeAmxd, encodeAmxd, type AmxdDevice } from "./codec.js";
import type { ReadOptions, WriteOptions } from "../types.js";
export function readAmxd(filePath: string, options?: ReadOptions): AmxdDevice {
  let bytes;
  try {
    bytes = readBytes(resolve(filePath), 64 * 1024 * 1024);
  } catch (cause) {
    throw new AmxdError(
      "MALFORMED_AMXD",
      `Could not read .amxd (${filePath})`,
      { cause },
    );
  }
  return decodeAmxd(bytes, options);
}
export function writeAmxd(
  filePath: string,
  device: AmxdDevice,
  options?: WriteOptions,
): void {
  writeAtomicFile(filePath, encodeAmxd(device, options), options);
}
