import { expect, it } from "vitest";
import { diffPatches, parsePatchObject } from "../core.js";
import type { RawPatcher } from "../schema/raw-patcher.js";

type Line = NonNullable<RawPatcher["lines"]>[number];
const cord = (destination: string, metadata = {}, wrapper = {}): Line => ({
  patchline: {
    source: ["source", 0],
    destination: [destination, 0],
    ...metadata,
  },
  ...wrapper,
});
const patch = (lines: Line[]) =>
  parsePatchObject({ patcher: { boxes: [], lines } });
const diff = (a: Line[], b: Line[]) => diffPatches(patch(a), patch(b));

it.each([0, 1, 2])(
  "reports only the inserted cord at position %i",
  (position) => {
    const before = [cord("a"), cord("b")];
    const after = [...before];
    const added = cord("new", { order: 3 }, { extension: true });
    after.splice(position, 0, added);
    expect(diff(before, after).changes).toEqual([
      { kind: "added", path: `/patcher/lines/${position}`, after: added },
    ]);
    expect(diff(after, before).changes).toEqual([
      { kind: "removed", path: `/patcher/lines/${position}`, before: added },
    ]);
  },
);

it("tracks relative order of surviving cords without insertion/deletion shifts", () => {
  const a = cord("a"),
    b = cord("b"),
    c = cord("c");
  expect(diff([a, b, c], [c, cord("new"), a]).changes).toEqual([
    {
      kind: "updated",
      path: "/patcher/lineOrder",
      before: [0, 2],
      after: [2, 0],
    },
    { kind: "removed", path: "/patcher/lines/1", before: b },
    { kind: "added", path: "/patcher/lines/1", after: cord("new") },
  ]);
  expect(diff([a, b], [b, a]).equal).toBe(false);
});

it("preserves identical duplicate multiplicity with deterministic occurrence matching", () => {
  const a = cord("a");
  expect(diff([a, a], [a, a, a]).changes).toEqual([
    { kind: "added", path: "/patcher/lines/2", after: a },
  ]);
  expect(diff([a, a, a], [a]).changes).toEqual([
    { kind: "removed", path: "/patcher/lines/1", before: a },
    { kind: "removed", path: "/patcher/lines/2", before: a },
  ]);
  expect(diff([a, a], [a, a]).equal).toBe(true);
});

it("matches complete wrappers before pairing changed metadata on duplicate endpoints", () => {
  const a = cord("a", { order: 0 }, { extension: { saved: true } });
  const b = cord("a", { order: 1 }, { extension: { saved: false } });
  const added = cord("a", { order: 2 });
  expect(diff([a, b], [added, a, b]).changes).toEqual([
    { kind: "added", path: "/patcher/lines/0", after: added },
  ]);
  expect(diff([a, b], [b, a]).changes).toEqual([
    {
      kind: "updated",
      path: "/patcher/lineOrder",
      before: [0, 1],
      after: [1, 0],
    },
  ]);
  expect(diff([a, b], [cord("a", { order: 4 }), b]).changes).toEqual([
    {
      kind: "removed",
      path: "/patcher/lines/0/extension",
      before: { saved: true },
    },
    {
      kind: "updated",
      path: "/patcher/lines/0/patchline/order",
      before: 0,
      after: 4,
    },
  ]);
});

it("compares metadata at the new index and ignores object key ordering", () => {
  const a = cord("a", { order: 0, extra: { a: 1, b: 2 } }, { label: "old" });
  const reordered = cord(
    "a",
    { extra: { b: 2, a: 1 }, order: 0 },
    { label: "old" },
  );
  expect(diff([a], [reordered]).equal).toBe(true);
  const changed = cord(
    "a",
    { order: 4, extra: { b: 2, a: 1 } },
    { label: "new" },
  );
  expect(diff([a], [cord("inserted"), changed]).changes).toEqual([
    { kind: "added", path: "/patcher/lines/0", after: cord("inserted") },
    {
      kind: "updated",
      path: "/patcher/lines/1/label",
      before: "old",
      after: "new",
    },
    {
      kind: "updated",
      path: "/patcher/lines/1/patchline/order",
      before: 0,
      after: 4,
    },
  ]);
});

it("represents a rewire as a removed and added cord without inferring identity", () => {
  expect(
    diff([cord("a"), cord("b")], [cord("new"), cord("b")]).changes,
  ).toEqual([
    { kind: "removed", path: "/patcher/lines/0", before: cord("a") },
    { kind: "added", path: "/patcher/lines/0", after: cord("new") },
  ]);
});

it("preserves negative zero and distinguishes it in endpoint and metadata matching", () => {
  const zero = cord("a", { order: 0 });
  const negative = cord("a", { order: -0 });
  expect(diff([zero], [negative]).changes).toEqual([
    {
      kind: "updated",
      path: "/patcher/lines/0/patchline/order",
      before: 0,
      after: -0,
    },
  ]);
  const endpoint = cord("a");
  endpoint.patchline.source[1] = -0;
  expect(diff([cord("a")], [endpoint]).changes.map((c) => c.kind)).toEqual([
    "removed",
    "added",
  ]);
});

it("applies connection matching independently inside nested patchers", () => {
  const nested = (lines: Line[]) =>
    parsePatchObject({
      patcher: {
        boxes: [
          {
            box: {
              id: "container",
              maxclass: "newobj",
              numinlets: 0,
              numoutlets: 0,
              patching_rect: [0, 0, 50, 20],
              patcher: { boxes: [], lines },
            },
          },
        ],
      },
    });
  expect(
    diffPatches(nested([cord("a")]), nested([cord("new"), cord("a")])).changes,
  ).toEqual([
    {
      kind: "added",
      path: "/patcher/boxes/container/box/patcher/lines/0",
      after: cord("new"),
    },
  ]);
});

it("handles a large duplicate list without shifting unchanged diagnostics", () => {
  const lines = Array.from({ length: 10000 }, () => cord("a"));
  expect(diff(lines, [cord("new"), ...lines]).changes).toEqual([
    { kind: "added", path: "/patcher/lines/0", after: cord("new") },
  ]);
});
