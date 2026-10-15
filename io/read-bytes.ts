import * as fs from "node:fs";

export function readBytes(source: string, maxBytes: number): Uint8Array {
  let fd: number | undefined;
  let bytes: Buffer;
  try {
    fd = fs.openSync(source, "r");
    if (fs.fstatSync(fd).size > maxBytes)
      throw new Error(`Input exceeds ${maxBytes} byte limit`);
    const chunks: Buffer[] = [];
    let total = 0;
    while (true) {
      const chunk = Buffer.allocUnsafe(Math.min(65536, maxBytes - total + 1));
      const count = fs.readSync(fd, chunk, 0, chunk.length, null);
      if (!count) break;
      total += count;
      if (total > maxBytes)
        throw new Error(`Input exceeds ${maxBytes} byte limit`);
      chunks.push(chunk.subarray(0, count));
    }
    bytes = Buffer.concat(chunks, total);
    fs.closeSync(fd);
    fd = undefined;
  } catch (cause) {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch (error_) {
        cause = new AggregateError([cause, error_], "Read and close failures");
      }
    }
    throw cause;
  }
  return bytes;
}
