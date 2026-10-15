import { diffPatches, type DiffChange } from "../../diff.js";
import { parsePatchObject } from "../../io/parse.js";
import type { AmxdDevice } from "../../amxd/codec.js";
import { stableStringify } from "../../io/serializer.js";
import { loadPatch } from "../load.js";
import { output, type CliIO } from "../output.js";
function containerPatch(device: AmxdDevice) {
  const container = device.container!;
  // ptch data belongs only to the structural diff. meta bytes duplicate container.meta.
  return parsePatchObject({
    patcher: { boxes: [] },
    container: {
      type: device.type,
      version: container.version,
      meta: container.meta,
      chunks: container.chunks.map((chunk) => ({
        tag: chunk.tag,
        ...(chunk.tag === "ptch" || chunk.tag === "meta"
          ? {}
          : { data: Buffer.from(chunk.data).toString("base64") }),
      })),
    },
  });
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
      ? diffPatches(containerPatch(a.device), containerPatch(b.device))
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
