import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { MaxpatWriteError } from "../errors.js";
import { serializePatch } from "./parse.js";
import type { NormalizedPatch, WriteOptions } from "../types.js";
export { serializePatch } from "./parse.js";
/** Atomic same-directory replacement, no symlink following. Not crash-durable or a CAS. */
export function writeFile(
  filePath: string,
  patch: NormalizedPatch,
  options?: WriteOptions,
): void {
  const target = path.resolve(filePath);
  const json = serializePatch(patch, options); // Validate before touching the filesystem.
  let fd: number | undefined;
  let temp: string | undefined;
  const cleanupErrors: unknown[] = [];
  try {
    let mode = 0o600;
    try {
      const stat = fs.lstatSync(target);
      if (!stat.isFile() || stat.isSymbolicLink())
        throw new Error("Destination must be a regular file, not a symlink");
      mode = stat.mode & 0o777;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    // A collision is safe (wx); retry with a new unpredictable name.
    for (let attempt = 0; attempt < 8; attempt++) {
      const candidate = path.join(
        path.dirname(target),
        `.maxpat-${randomUUID()}.tmp`,
      );
      try {
        fd = fs.openSync(candidate, "wx", 0o600);
        temp = candidate;
        break;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      }
    }
    if (fd === undefined || temp === undefined)
      throw new Error(
        "Could not allocate exclusive temporary file after eight attempts",
      );
    fs.writeFileSync(fd, json, "utf8");
    if (process.platform !== "win32") fs.fchmodSync(fd, mode);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(temp, target);
    temp = undefined;
  } catch (cause) {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch (e) {
        cleanupErrors.push(e);
      }
    }
    if (temp !== undefined) {
      try {
        fs.unlinkSync(temp);
      } catch (e) {
        cleanupErrors.push(e);
      }
    }
    throw new MaxpatWriteError(
      "Atomic patch replacement failed",
      target,
      cleanupErrors.length
        ? new AggregateError(
            [cause, ...cleanupErrors],
            "Write and cleanup failures",
          )
        : cause,
    );
  }
}
