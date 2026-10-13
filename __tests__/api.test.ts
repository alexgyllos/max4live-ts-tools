import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  PatchEditor,
  PatchBuilder,
  parsePatchObject,
  parsePatch,
  serializePatch,
  queryPatch,
  walkPatch,
  validateGraph,
} from "../core.js";
import { PatchEditor as NodeEditor } from "../index.js";
import { createIdGenerator } from "../editor/id-gen.js";
const raw = () =>
  JSON.parse(
    readFileSync(new URL("./fixtures/nested.maxpat", import.meta.url), "utf8"),
  );
const spec = () => ({
  maxclass: "newobj",
  numinlets: 1,
  numoutlets: 1,
  patchingRect: [0, 0, 80, 22] as const,
  passthrough: { saved: { value: [1, 2] }, text: "test" },
});
it("owns all input, output, queries, metadata and revision boundaries", () => {
  const input = parsePatchObject(raw());
  const editor = PatchEditor.fromNormalized(input);
  input.boxes.clear();
  input.patcherMeta.passthrough.extra = "tampered";
  input.lines.length = 0;
  input.boxOrder.length = 0;
  expect(editor.toNormalized().boxes.size).toBe(3);
  expect(editor.linesFrom("obj-1")).toHaveLength(1);
  const snapshot = editor.toNormalized();
  snapshot.boxes.clear();
  snapshot.patcherMeta.appversion = { major: 0 };
  snapshot.boxOrder.reverse();
  snapshot.lines[0].passthrough.order = 9;
  const box = editor.findById("obj-2")!;
  (box.passthrough.patcher as Record<string, unknown>).boxes = [];
  const line = editor.linesTo("obj-2")[0];
  line.sourceId = "tampered";
  const queried = editor.findByClass("newobj");
  queried[0].patchingRect = [99, 99, 99, 99];
  const output = editor.toRaw();
  output.patcher.boxes[0].box.maxclass = "tampered";
  expect(editor.toRaw()).toEqual(raw());
  const added = spec();
  const next = editor.addBox(added, "obj-4");
  added.passthrough.saved.value.length = 0;
  const update = { passthrough: { saved: { value: [8] } } };
  const later = next.updateBox("obj-4", update);
  update.passthrough.saved.value[0] = 99;
  expect(next.findById("obj-4")!.passthrough.saved).toEqual({ value: [1, 2] });
  expect(later.findById("obj-4")!.passthrough.saved).toEqual({ value: [8] });
});
it("custom rules cannot mutate editors or other rule inputs", () => {
  const e = PatchEditor.fromRaw(raw());
  const before = e.toRaw();
  e.validate(undefined, [
    {
      code: "X",
      check: (p) => {
        p.boxes.clear();
        p.patcherMeta.passthrough.wrong = true;
        return [];
      },
    },
  ]);
  expect(e.toRaw()).toEqual(before);
});
it("checks programmatic ports, geometry, IDs and explicit failure contracts", () => {
  const e = PatchEditor.fromRaw(raw());
  for (const n of [NaN, Infinity, -1, 0.5]) {
    expect(() => e.connect(["obj-1", n], ["obj-2", 0])).toThrow();
    expect(() => e.addBox({ ...spec(), numinlets: n })).toThrow();
  }
  expect(() => e.addBox(spec(), "obj-1")).toThrow(/exists/);
  expect(() => e.addBox(spec(), "")).toThrow();
  expect(() => e.updateBox("obj-1", { numoutlets: 0 })).toThrow(/Disconnect/);
  expect(() => e.updateBox("obj-1", { patchingRect: [0, 0, -1, 1] })).toThrow();
  expect(() => e.removeBox("missing")).toThrow();
  expect(() => e.updateBox("obj-1", { id: "new" } as never)).toThrow();
  expect(e.removeBox("obj-2").linesFrom("obj-1")).toEqual([]);
  const huge = e.addBox(spec(), "obj-999999999999999999999999");
  const gen = createIdGenerator(huge.toNormalized());
  expect(gen()).toBe("obj-1000000000000000000000000");
  expect(gen()).toBe("obj-1000000000000000000000001");
});
it("validates embedded graphs with scope-local locations", () => {
  const r = raw();
  r.patcher.boxes[1].box.patcher.lines[0].patchline.destination = [
    "missing",
    0,
  ];
  const p = parsePatchObject(r);
  const result = validateGraph(p);
  expect(result.ok).toBe(false);
  expect(
    result.diagnostics.find((d) => d.code === "E003")?.location?.path,
  ).toBe('["obj-2"]');
  expect(() => serializePatch(p)).toThrow();
  expect(() => serializePatch(p, { skipValidation: true })).not.toThrow();
  expect(validateGraph(p, { E003: "off" }).ok).toBe(true);
});
it("walks, queries and edits a scope without touching its parent/siblings", () => {
  const p = parsePatchObject(raw());
  expect([...walkPatch(p)].map((s) => s.path)).toEqual([[], ["obj-2"]]);
  expect(
    queryPatch(p, { text: "print", match: "partial" }).map((b) => b.path),
  ).toEqual([[], ["obj-2"]]);
  const original = PatchEditor.fromNormalized(p);
  const updated = original.editAtPath(["obj-2"], (e) =>
    e.updateBox("obj-1", { passthrough: { text: "changed" } }),
  );
  expect(original.toRaw()).toEqual(raw());
  expect(updated.findById("obj-1")!.passthrough.text).toBe("loadbang");
  expect(updated.atPath(["obj-2"]).findById("obj-1")!.passthrough.text).toBe(
    "changed",
  );
  expect(() => updated.atPath(["external"])).toThrow(/embedded/);
  expect(() => updated.atPath(Array(25).fill("obj-2"))).toThrow(/24/);
});
it("builder creates deterministic practical objects, layout and metadata", () => {
  const empty = new PatchBuilder({
    rect: [0, 0, 600, 400],
    metadata: { fileversion: 1 },
  });
  const b = empty
    .object({
      id: "source",
      text: "loadbang",
      numinlets: 0,
      numoutlets: 1,
      at: [10, 20],
    })
    .object({
      id: "sink",
      text: "print example",
      varname: "output",
      numinlets: 1,
      numoutlets: 0,
      at: [10, 80],
    })
    .connect(["source", 0], ["sink", 0], { order: 0 })
    .metadata({ classnamespace: "box" });
  expect(empty.toNormalized().boxes.size).toBe(0);
  expect(b.editor.validate().ok).toBe(true);
  expect(b.editor.findByText("print", { match: "partial" })).toHaveLength(1);
  expect(b.editor.findByVarname("output")).toHaveLength(1);
  expect(b.toRaw().patcher.boxes[0].box.patching_rect).toEqual([
    10, 20, 80, 22,
  ]);
});
it("Node adapters survive immutable revisions", () => {
  const editor = NodeEditor.fromRaw(raw())
    .addBox(spec(), "obj-4")
    .updateBox("obj-4", { passthrough: { text: "node" } });
  expect(editor).toBeInstanceOf(NodeEditor);
  expect(editor.write).toBeTypeOf("function");
});
it("bounded generated patches round-trip deeply and deterministically", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const boxes = Array.from({ length: seed * 7 }, (_, i) => ({
      box: {
        id: `box-${i}`,
        maxclass: i % 2 ? "unusual.class" : "newobj",
        numinlets: 1,
        numoutlets: 1,
        patching_rect: [i * 3, -i, 80, 22],
        unknown: { seed, values: [true, null, "𝄞"] },
      },
    }));
    const lines = boxes.slice(1).map((_, i) => ({
      patchline: {
        source: [`box-${i}`, 0],
        destination: [`box-${i + 1}`, 0],
        order: i,
      },
    }));
    const data = { patcher: { boxes, lines }, extension: { seed } };
    const p = parsePatchObject(data);
    expect(JSON.parse(serializePatch(p))).toEqual(data);
    expect(serializePatch(parsePatch(serializePatch(p)))).toBe(
      serializePatch(p),
    );
  }
  const large = {
    patcher: {
      boxes: Array.from({ length: 10000 }, (_, i) => ({
        box: {
          id: `b${i}`,
          maxclass: "button",
          numinlets: 1,
          numoutlets: 1,
          patching_rect: [0, 0, 20, 20],
        },
      })),
    },
  };
  expect(parsePatch(serializePatch(parsePatchObject(large))).boxes.size).toBe(
    10000,
  );
}, 20000);
it("rejects malformed attribute containers and paths before editing", () => {
  const e = PatchEditor.fromRaw(raw());
  for (const invalid of [[], 42, "hello", null]) {
    expect(() =>
      e.addBox({ ...spec(), passthrough: invalid as never }),
    ).toThrow();
    expect(() =>
      e.updateBox("obj-1", { passthrough: invalid as never }),
    ).toThrow();
    expect(() => e.withMetadata({ passthrough: invalid as never })).toThrow();
  }
  for (const path of ["obj-2", {}, [1], [""]]) {
    expect(() => e.atPath(path as never)).toThrow();
    expect(() =>
      e.editAtPath(path as never, (x) => x.removeBox("obj-1")),
    ).toThrow();
  }
});
it("custom rules and root traversal retain root metadata", () => {
  const r = raw();
  const p = parsePatchObject(r);
  expect([...walkPatch(p)][0].patch.rootPassthrough).toEqual(p.rootPassthrough);
  let root: unknown;
  validateGraph(p, undefined, [
    {
      code: "X",
      check: (scope) => {
        if (scope.boxes.has("external")) root = scope.rootPassthrough;
        return [];
      },
    },
  ]);
  expect(root).toEqual(p.rootPassthrough);
});
it("disconnect repairs invalid existing graph connections", () => {
  const r = raw();
  r.patcher.lines[0].patchline.destination = ["missing", 0];
  const e = PatchEditor.fromRaw(r);
  expect(e.validate().ok).toBe(false);
  const repaired = e.disconnect(["obj-1", 0], ["missing", 0]);
  expect(repaired.validate().ok).toBe(true);
});
it("structural graph rejection never evaluates unsafe getters", () => {
  const p = parsePatchObject(raw());
  let called = false;
  Object.defineProperty(p.boxes.get("obj-1")!, "patchingRect", {
    get() {
      called = true;
      throw new Error("getter");
    },
    enumerable: true,
  });
  expect(validateGraph(p).diagnostics.some((d) => d.code === "S001")).toBe(
    true,
  );
  expect(called).toBe(false);
});
it("invalid rule overrides cannot downgrade errors accidentally", () => {
  const r = raw();
  r.patcher.lines[0].patchline.destination = ["missing", 0];
  const p = parsePatchObject(r);
  expect(validateGraph(p, { E003: "bogus" } as never).ok).toBe(false);
  expect(() =>
    serializePatch(p, { ruleConfig: { E003: "bogus" } as never }),
  ).toThrow();
});
it("normalized root accessors are rejected without execution", () => {
  const p = parsePatchObject(raw());
  let called = false;
  Object.defineProperty(p, "boxes", {
    get() {
      called = true;
      throw new Error("getter");
    },
    enumerable: true,
  });
  expect(validateGraph(p).ok).toBe(false);
  expect(called).toBe(false);
});
it("inherited normalized accessors are rejected before execution", () => {
  const p = parsePatchObject({ patcher: { boxes: [] } });
  let called = false;
  delete p.linesPresent;
  Object.setPrototypeOf(p, {
    get linesPresent() {
      called = true;
      return false;
    },
  });
  expect(() => serializePatch(p)).toThrow();
  expect(called).toBe(false);
});
it("custom codes colliding with Object prototype keep their requested severity", () => {
  const p = parsePatchObject({ patcher: { boxes: [] } });
  const r = validateGraph(p, {}, [
    {
      code: "constructor",
      check: () => [
        { code: "constructor", severity: "error", message: "error" },
      ],
    },
  ]);
  expect(r.ok).toBe(false);
  expect(r.diagnostics[0].severity).toBe("error");
});
