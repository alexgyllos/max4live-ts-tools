import { diffPatches, type DiffChange } from "../../diff.js";
import { createHash } from "node:crypto";
import type { AmxdChunk, AmxdDevice } from "../../amxd/codec.js";
import { stableStringify } from "../../io/serializer.js";
import { loadPatch } from "../load.js";
import { output, type CliIO } from "../output.js";
const opaque = (chunk: AmxdChunk): boolean =>
  chunk.tag !== "ptch" && chunk.tag !== "meta";
function chunkSummary(chunk: AmxdChunk, index: number) {
  return {
    index,
    tag: chunk.tag,
    ...(opaque(chunk)
      ? {
          size: chunk.data.length,
          sha256Prefix: createHash("sha256")
            .update(chunk.data)
            .digest("hex")
            .slice(0, 16),
        }
      : {}),
  };
}
/** Compare decoded framing directly. Payload JSON is compared only by diffPatches. */
export function diffContainers(before: AmxdDevice, after: AmxdDevice) {
  const a = before.container!,
    b = after.container!;
  const changes: DiffChange[] = [];
  for (const [key, oldValue, newValue] of [
    ["type", before.type, after.type],
    ["version", a.version, b.version],
    ["meta", a.meta, b.meta],
  ] as const)
    if (oldValue !== newValue)
      changes.push({
        kind: "updated",
        path: `/container/${key}`,
        before: oldValue,
        after: newValue,
      });
  for (
    let index = 0;
    index < Math.max(a.chunks.length, b.chunks.length);
    index++
  ) {
    const oldChunk = a.chunks[index],
      newChunk = b.chunks[index];
    const path = `/container/chunks/${index}`;
    if (!oldChunk)
      changes.push({
        kind: "added",
        path,
        after: chunkSummary(newChunk, index),
      });
    else if (!newChunk)
      changes.push({
        kind: "removed",
        path,
        before: chunkSummary(oldChunk, index),
      });
    else if (
      oldChunk.tag !== newChunk.tag ||
      (opaque(oldChunk) && Buffer.compare(oldChunk.data, newChunk.data) !== 0)
    )
      changes.push({
        kind: "updated",
        path,
        before: chunkSummary(oldChunk, index),
        after: chunkSummary(newChunk, index),
      });
  }
  changes.sort((x, y) => (x.path < y.path ? -1 : x.path > y.path ? 1 : 0));
  return { equal: changes.length === 0, changes };
}
export function diff(
  files: string[],
  includeContainer: boolean,
  json: boolean,
  io: CliIO,
): number {
  const a = loadPatch(files[0]),
    b = loadPatch(files[1]);
  if (includeContainer && (a.format !== "amxd" || b.format !== "amxd"))
    throw new Error("--include-container requires two .amxd inputs");
  const patcher = diffPatches(a.patch, b.patch);
  const container =
    includeContainer && a.format === "amxd" && b.format === "amxd"
      ? diffContainers(a.device, b.device)
      : undefined;
  const equal = patcher.equal && (container?.equal ?? true);
  const describe = (changes: DiffChange[]) =>
    changes
      .map(
        (c) =>
          `${c.kind} ${c.path}: ${Object.hasOwn(c, "before") ? stableStringify(c.before) : "<absent>"} -> ${Object.hasOwn(c, "after") ? stableStringify(c.after) : "<absent>"}`,
      )
      .join("\n");
  output(
    io,
    json,
    {
      command: "diff",
      ...patcher,
      equal,
      ...(container
        ? { container: { equal: container.equal, changes: container.changes } }
        : {}),
    },
    equal
      ? "Structurally equal\n"
      : [
          describe(patcher.changes),
          container ? describe(container.changes) : "",
        ]
          .filter(Boolean)
          .join("\n") + "\n",
  );
  return equal ? 0 : 1;
}
