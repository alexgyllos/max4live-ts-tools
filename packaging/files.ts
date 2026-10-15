import * as fs from "node:fs";
import * as path from "node:path";

export const MAX_FILE_BYTES = 64 * 1024 * 1024;
export const portable = (value: string): string =>
  value.split(path.sep).join("/");
export function inside(root: string, file: string): boolean {
  const relative = path.relative(root, file);
  return (
    relative === "" ||
    (!path.isAbsolute(relative) &&
      relative !== ".." &&
      !relative.startsWith(`..${path.sep}`))
  );
}
export function projectRoot(input: string): string {
  if (fs.lstatSync(input).isSymbolicLink())
    throw new Error(`Symlink root is not supported: ${input}`);
  const root = fs.realpathSync(input);
  if (!fs.statSync(root).isDirectory())
    throw new Error(`Expected a project directory: ${input}`);
  return root;
}
/** Reject symlinks in every component below an explicitly allowed root. */
export function checkPath(file: string, roots: string[]): void {
  const root = roots
    .filter((root) => inside(root, file))
    .sort((a, b) => b.length - a.length)[0];
  if (!root) throw new Error(`Path is outside project roots: ${file}`);
  let current = root;
  for (const part of path
    .relative(root, file)
    .split(path.sep)
    .filter(Boolean)) {
    current = path.join(current, part);
    if (fs.lstatSync(current).isSymbolicLink())
      throw new Error(`Symlink dependencies are not supported: ${current}`);
  }
}
export function readSafe(file: string, roots: string[]): Buffer {
  checkPath(file, roots);
  if (!fs.lstatSync(file).isFile())
    throw new Error(`Expected a regular file: ${file}`);
  const fd = fs.openSync(
    file,
    fs.constants.O_RDONLY |
      (fs.constants.O_NOFOLLOW ?? 0) |
      (fs.constants.O_NONBLOCK ?? 0),
  );
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES)
      throw new Error(`Expected a regular file of at most 64 MiB: ${file}`);
    const chunks: Buffer[] = [];
    let size = 0;
    while (true) {
      const chunk = Buffer.allocUnsafe(
        Math.min(65536, MAX_FILE_BYTES - size + 1),
      );
      const n = fs.readSync(fd, chunk, 0, chunk.length, null);
      if (!n) break;
      size += n;
      if (size > MAX_FILE_BYTES)
        throw new Error(`File exceeds 64 MiB: ${file}`);
      chunks.push(chunk.subarray(0, n));
    }
    return Buffer.concat(chunks, size);
  } finally {
    fs.closeSync(fd);
  }
}
