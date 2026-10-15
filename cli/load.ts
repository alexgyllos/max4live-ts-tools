import { openSync, readSync, closeSync } from "node:fs";
import { extname } from "node:path";
import { readFile } from "../io/reader.js";
import { readAmxd } from "../amxd/files.js";
import { AmxdError, type AmxdDevice } from "../amxd/codec.js";
import { validateDeviceProject } from "../amxd/validate.js";
import type { NormalizedPatch } from "../types.js";
export type LoadedPatch =
  | { format: "maxpat"; patch: NormalizedPatch }
  | { format: "amxd"; patch: NormalizedPatch; device: AmxdDevice };
export class InputFormatError extends Error {
  constructor(
    readonly code: "UNKNOWN_FORMAT" | "FORMAT_MISMATCH",
    message: string,
  ) {
    super(message);
    this.name = "InputFormatError";
  }
}
/** Header is authoritative; the extension supplies mismatch diagnostics. Parsing stays in the existing readers. */
export function loadPatch(file: string): LoadedPatch {
  const fd = openSync(file, "r");
  const prefix = Buffer.alloc(4);
  let count: number;
  try {
    count = readSync(fd, prefix, 0, 4, 0);
  } finally {
    closeSync(fd);
  }
  const header = prefix.subarray(0, count).toString("ascii");
  const extension = extname(file).toLowerCase();
  if (header === "ciph")
    throw new AmxdError(
      "UNSUPPORTED_AMXD",
      "Encrypted ciph devices are not supported; use an unfrozen JSON device",
    );
  if (["ampf", "mx@c"].includes(header)) {
    if (extension === ".maxpat")
      throw new InputFormatError(
        "FORMAT_MISMATCH",
        `Binary device has a .maxpat extension (${file}); use .amxd`,
      );
    const device = readAmxd(file);
    validateDeviceProject(device);
    return { format: "amxd", patch: device.patch, device };
  }
  if (extension === ".amxd") {
    // Reuse the codec's actionable malformed-container diagnostic.
    readAmxd(file);
    throw new InputFormatError(
      "FORMAT_MISMATCH",
      `Expected .amxd container (${file})`,
    );
  }
  // Preserve .maxpat parsing errors and arbitrary JSON filenames supported by v0.1.0.
  if (
    extension !== ".maxpat" &&
    !/^\s*(?:\{|$)/u.test(prefix.subarray(0, count).toString("utf8"))
  )
    throw new InputFormatError(
      "UNKNOWN_FORMAT",
      `Expected .maxpat JSON or a supported .amxd container (${file})`,
    );
  return { format: "maxpat", patch: readFile(file) };
}
