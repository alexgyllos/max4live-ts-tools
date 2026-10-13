import { toPatchObject } from "./io/parse.js";
import { stableStringify } from "./io/serializer.js";
import type { NormalizedPatch } from "./types.js";
import type { RawPatcher } from "./schema/index.js";
export type DiffChange = {
  kind: "added" | "removed" | "updated";
  path: string;
  before?: unknown;
  after?: unknown;
};
export type PatchDiff = {
  mode: "structural";
  equal: boolean;
  changes: DiffChange[];
};
const escape = (key: string): string =>
  key.replaceAll("~", "~0").replaceAll("/", "~1");
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
/** ID-sensitive deep structural diff. Retains array ordering, wrappers, fields and nested graph changes. */
export function diffPatches(
  before: NormalizedPatch,
  after: NormalizedPatch,
): PatchDiff {
  const a = toPatchObject(before, { skipValidation: true });
  const b = toPatchObject(after, { skipValidation: true });
  const changes: DiffChange[] = [];
  function compare(x: unknown, y: unknown, path: string): void {
    if (Object.is(x, y)) return;
    if (Array.isArray(x) && Array.isArray(y)) {
      for (let i = 0; i < Math.max(x.length, y.length); i++)
        field(x, y, String(i), `${path}/${i}`);
    } else if (object(x) && object(y)) {
      for (const k of [
        ...new Set([...Object.keys(x), ...Object.keys(y)]),
      ].sort()) {
        const next = `${path}/${escape(k)}`;
        field(x, y, k, next);
      }
    } else changes.push({ kind: "updated", path, before: x, after: y });
  }
  function field(x: object, y: object, key: string, path: string): void {
    const xv = (x as Record<string, unknown>)[key],
      yv = (y as Record<string, unknown>)[key];
    if (!Object.hasOwn(x, key))
      changes.push({ kind: "added", path, after: yv });
    else if (!Object.hasOwn(y, key))
      changes.push({ kind: "removed", path, before: xv });
    else compare(xv, yv, path);
  }
  function compareLines(
    x: NonNullable<RawPatcher["lines"]>,
    y: NonNullable<RawPatcher["lines"]>,
    path: string,
  ): void {
    const xMatch = new Array<number>(x.length).fill(-1);
    const yMatch = new Array<number>(y.length).fill(-1);
    // Exact matches take precedence over endpoint matches, so inserting a cord
    // with different metadata cannot consume an unchanged duplicate's identity.
    function match(key: (line: (typeof x)[number]) => string): void {
      const queues = new Map<string, { indices: number[]; cursor: number }>();
      x.forEach((line, i) => {
        if (xMatch[i] !== -1) return;
        const fingerprint = key(line);
        const queue = queues.get(fingerprint);
        if (queue) queue.indices.push(i);
        else queues.set(fingerprint, { indices: [i], cursor: 0 });
      });
      y.forEach((line, j) => {
        if (yMatch[j] !== -1) return;
        const queue = queues.get(key(line));
        if (!queue || queue.cursor === queue.indices.length) return;
        const i = queue.indices[queue.cursor++];
        xMatch[i] = j;
        yMatch[j] = i;
      });
    }
    match(stableStringify);
    match((line) =>
      stableStringify([line.patchline.source, line.patchline.destination]),
    );
    x.forEach((line, i) => {
      if (xMatch[i] === -1)
        changes.push({
          kind: "removed",
          path: `${path}/lines/${i}`,
          before: line,
        });
    });
    y.forEach((line, j) => {
      const i = yMatch[j];
      if (i === -1)
        changes.push({
          kind: "added",
          path: `${path}/lines/${j}`,
          after: line,
        });
      else compare(x[i], line, `${path}/lines/${j}`);
    });
    // Compare the relative order of matched occurrences only. Index shifts from
    // an insertion/deletion are not reorders. Values identify original indices.
    const xOrder = xMatch.flatMap((j, i) => (j === -1 ? [] : [i]));
    const yOrder = yMatch.filter((i) => i !== -1);
    if (xOrder.some((i, position) => i !== yOrder[position]))
      changes.push({
        kind: "updated",
        path: `${path}/lineOrder`,
        before: xOrder,
        after: yOrder,
      });
  }
  function comparePatcher(x: RawPatcher, y: RawPatcher, path: string): void {
    for (const k of [...new Set([...Object.keys(x), ...Object.keys(y)])]
      .filter((k) => k !== "boxes" && k !== "lines")
      .sort())
      field(x, y, k, `${path}/${escape(k)}`);
    if (x.lines && y.lines) compareLines(x.lines, y.lines, path);
    else if (Object.hasOwn(x, "lines") || Object.hasOwn(y, "lines"))
      field(x, y, "lines", `${path}/lines`);
    const xOrder = x.boxes.map((w) => w.box.id),
      yOrder = y.boxes.map((w) => w.box.id);
    if (JSON.stringify(xOrder) !== JSON.stringify(yOrder))
      changes.push({
        kind: "updated",
        path: `${path}/boxOrder`,
        before: xOrder,
        after: yOrder,
      });
    const xBoxes = Object.fromEntries(x.boxes.map((w) => [w.box.id, w])),
      yBoxes = Object.fromEntries(y.boxes.map((w) => [w.box.id, w]));
    for (const id of [...new Set([...xOrder, ...yOrder])].sort())
      if (Object.hasOwn(xBoxes, id) && Object.hasOwn(yBoxes, id)) {
        const a = xBoxes[id],
          b = yBoxes[id],
          boxPath = `${path}/boxes/${escape(id)}`;
        for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])]
          .filter((k) => k !== "box")
          .sort())
          field(a, b, k, `${boxPath}/${escape(k)}`);
        for (const k of [
          ...new Set([...Object.keys(a.box), ...Object.keys(b.box)]),
        ].sort()) {
          const fieldPath = `${boxPath}/box/${escape(k)}`;
          if (k === "patcher" && a.box.patcher && b.box.patcher)
            comparePatcher(a.box.patcher, b.box.patcher, fieldPath);
          else field(a.box, b.box, k, fieldPath);
        }
      } else field(xBoxes, yBoxes, id, `${path}/boxes/${escape(id)}`);
  }
  for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .filter((k) => k !== "patcher")
    .sort())
    field(a, b, k, `/${escape(k)}`);
  comparePatcher(a.patcher, b.patcher, "/patcher");
  changes.sort((x, y) => (x.path < y.path ? -1 : x.path > y.path ? 1 : 0));
  return { mode: "structural", equal: changes.length === 0, changes };
}
