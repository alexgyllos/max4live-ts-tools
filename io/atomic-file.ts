import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { MaxpatWriteError } from "../errors.js";

/** Shared synchronous file replacement for JSON and binary output. */
export function writeAtomicFile(
  filePath: string,
  data: string | Uint8Array,
  options?: { overwrite?: boolean },
): void {
  const target = path.resolve(filePath);
  let fd: number | undefined;
  let temp: string | undefined;
  let committed = false;
  const cleanupErrors: unknown[] = [];
  try {
    let mode = 0o600;
    try {
      const stat = fs.lstatSync(target);
      if (!stat.isFile() || stat.isSymbolicLink())
        throw new Error("Destination must be a regular file, not a symlink");
      if (options?.overwrite === false)
        throw Object.assign(
          new Error("Destination already exists; use --force to replace it"),
          { code: "EEXIST" },
        );
      mode = stat.mode & 0o777;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    // Exclusive creation leaves collisions intact; retry with a new name.
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
    fs.writeFileSync(fd, data);
    if (process.platform !== "win32") fs.fchmodSync(fd, mode);
    fs.closeSync(fd);
    fd = undefined;
    if (options?.overwrite === false) {
      // An atomic hard-link install cannot clobber a destination created after lstat.
      // Both paths share a directory/filesystem; the fully written inode is visible at once.
      fs.linkSync(temp, target);
      committed = true;
      fs.unlinkSync(temp);
      temp = undefined;
      return;
    }
    // Windows can briefly deny replacement while another process releases its
    // file handle. Retry only the failed rename, never unlink the destination.
    for (let attempt = 0; ; attempt++) {
      try {
        fs.renameSync(temp, target);
        break;
      } catch (error) {
        if (
          process.platform !== "win32" ||
          !["EPERM", "EACCES", "EBUSY"].includes(
            (error as NodeJS.ErrnoException).code ?? "",
          ) ||
          attempt === 7
        )
          throw error;
        Atomics.wait(
          new Int32Array(new SharedArrayBuffer(4)),
          0,
          0,
          20 * (attempt + 1),
        );
      }
    }
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
    if (committed && cleanupErrors.length === 0) return;
    throw new MaxpatWriteError(
      committed
        ? "Destination created, but temporary-file cleanup failed"
        : (cause as NodeJS.ErrnoException)?.code === "EEXIST" &&
            options?.overwrite === false
          ? "Destination already exists; use --force to replace it (library: overwrite: true)"
          : "Atomic patch replacement failed",
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
