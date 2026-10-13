import { describe, it, expect } from "vitest";
import { validateGraph } from "../validate/graph.js";
import type {
  NormalizedPatch,
  NormalizedBox,
  NormalizedLine,
} from "../types.js";

const makeBox = (
  id: string,
  numinlets: number,
  numoutlets: number,
): NormalizedBox => ({
  id,
  maxclass: "newobj",
  numinlets,
  numoutlets,
  patchingRect: [0, 0, 80, 22],
  passthrough: {},
});

const makeLine = (
  srcId: string,
  srcOutlet: number,
  dstId: string,
  dstInlet: number,
): NormalizedLine => ({
  sourceId: srcId,
  sourceOutlet: srcOutlet,
  destId: dstId,
  destInlet: dstInlet,
  passthrough: {},
});

const makePatch = (
  boxList: NormalizedBox[],
  lines: NormalizedLine[],
  duplicateBoxIds: string[] = [],
): NormalizedPatch => ({
  patcherMeta: { passthrough: {} },
  boxes: new Map(boxList.map((b) => [b.id, b])),
  lines,
  boxOrder: boxList.map((b) => b.id),
  duplicateBoxIds,
});

describe("validateGraph", () => {
  it("returns ok for a valid patch", () => {
    const patch = makePatch(
      [makeBox("obj-1", 0, 1), makeBox("obj-2", 1, 0)],
      [makeLine("obj-1", 0, "obj-2", 0)],
    );
    const result = validateGraph(patch);
    expect(result.ok).toBe(true);
    expect(
      result.diagnostics.filter((d) => d.severity === "error"),
    ).toHaveLength(0);
  });

  it("emits E002 for missing source box", () => {
    const patch = makePatch(
      [makeBox("obj-2", 1, 0)],
      [makeLine("obj-99", 0, "obj-2", 0)],
    );
    const result = validateGraph(patch);
    const e2 = result.diagnostics.filter((d) => d.code === "E002");
    expect(e2).toHaveLength(1);
    expect(e2[0].severity).toBe("error");
    expect(e2[0].location?.sourceId).toBe("obj-99");
    expect(e2[0].location?.lineIndex).toBe(0);
  });

  it("emits E003 for missing destination box", () => {
    const patch = makePatch(
      [makeBox("obj-1", 0, 1)],
      [makeLine("obj-1", 0, "obj-99", 0)],
    );
    const result = validateGraph(patch);
    const e3 = result.diagnostics.filter((d) => d.code === "E003");
    expect(e3).toHaveLength(1);
    expect(e3[0].severity).toBe("error");
    expect(e3[0].location?.destId).toBe("obj-99");
    expect(e3[0].location?.lineIndex).toBe(0);
  });

  it("emits E004 when source outlet equals numoutlets", () => {
    const patch = makePatch(
      [makeBox("obj-1", 0, 1), makeBox("obj-2", 1, 0)],
      [makeLine("obj-1", 1, "obj-2", 0)], // outlet 1 but numoutlets=1 (max valid is 0)
    );
    const result = validateGraph(patch);
    const e4 = result.diagnostics.filter((d) => d.code === "E004");
    expect(e4).toHaveLength(1);
    expect(e4[0].severity).toBe("error");
    expect(e4[0].location?.sourceId).toBe("obj-1");
    expect(e4[0].location?.lineIndex).toBe(0);
  });

  it("emits E005 when destination inlet equals numinlets", () => {
    const patch = makePatch(
      [makeBox("obj-1", 0, 1), makeBox("obj-2", 1, 0)],
      [makeLine("obj-1", 0, "obj-2", 1)], // inlet 1 but numinlets=1 (max valid is 0)
    );
    const result = validateGraph(patch);
    const e5 = result.diagnostics.filter((d) => d.code === "E005");
    expect(e5).toHaveLength(1);
    expect(e5[0].severity).toBe("error");
    expect(e5[0].location?.destId).toBe("obj-2");
  });

  it("emits W001 for duplicate patchline", () => {
    const patch = makePatch(
      [makeBox("obj-1", 0, 1), makeBox("obj-2", 1, 0)],
      [makeLine("obj-1", 0, "obj-2", 0), makeLine("obj-1", 0, "obj-2", 0)],
    );
    const result = validateGraph(patch);
    const w1 = result.diagnostics.filter((d) => d.code === "W001");
    expect(w1).toHaveLength(1);
    expect(w1[0].severity).toBe("warning");
    expect(w1[0].location?.lineIndex).toBe(1);
  });

  it("emits I001 for orphan box", () => {
    const patch = makePatch(
      [makeBox("obj-1", 0, 1), makeBox("obj-orphan", 1, 0)],
      [makeLine("obj-1", 0, "obj-1", 0)], // self-loop to keep obj-1 connected
    );
    const result = validateGraph(patch);
    const i1 = result.diagnostics.filter((d) => d.code === "I001");
    expect(i1.map((d) => d.location?.boxId)).toContain("obj-orphan");
    expect(i1[0].location?.boxId).toBeDefined();
  });

  it("suppresses I001 when overridden to off", () => {
    const patch = makePatch([makeBox("obj-orphan", 1, 0)], []);
    const result = validateGraph(patch, { I001: "off" });
    expect(result.diagnostics.filter((d) => d.code === "I001")).toHaveLength(0);
  });

  it("elevates W001 to error via RuleConfig", () => {
    const patch = makePatch(
      [makeBox("obj-1", 0, 1), makeBox("obj-2", 1, 0)],
      [makeLine("obj-1", 0, "obj-2", 0), makeLine("obj-1", 0, "obj-2", 0)],
    );
    const result = validateGraph(patch, { W001: "error" });
    const w1 = result.diagnostics.filter((d) => d.code === "W001");
    expect(w1[0].severity).toBe("error");
    expect(result.ok).toBe(false);
  });

  it("runs a custom rule and emits project-defined code", () => {
    const patch = makePatch([makeBox("obj-1", 0, 1)], []);
    const result = validateGraph(patch, undefined, [
      {
        code: "X001",
        check: (_p) => [
          { severity: "warning", code: "X001", message: "custom check fired" },
        ],
      },
    ]);
    const x1 = result.diagnostics.filter((d) => d.code === "X001");
    expect(x1).toHaveLength(1);
    expect(x1[0].message).toBe("custom check fired");
  });

  it("ok is false only when error diagnostics exist", () => {
    const patch = makePatch([makeBox("obj-orphan", 1, 0)], []);
    const result = validateGraph(patch); // I001 only
    expect(result.ok).toBe(true); // info is not an error
  });

  it("emits E001 for duplicate box IDs tracked by normalize", () => {
    const patch = makePatch(
      [makeBox("obj-1", 0, 1), makeBox("obj-2", 1, 0)],
      [],
      ["obj-1"], // simulate duplicate detected during normalize
    );
    const result = validateGraph(patch);
    const e1 = result.diagnostics.filter((d) => d.code === "S001");
    expect(e1).toHaveLength(1);
    expect(e1[0].severity).toBe("error");
    expect(e1[0].message).toContain("Duplicate");
    expect(result.ok).toBe(false);
  });

  it("emits E006 for malformed patching_rect", () => {
    const badBox: NormalizedBox = {
      id: "obj-bad",
      maxclass: "newobj",
      numinlets: 1,
      numoutlets: 0,
      patchingRect: [0, 0, Infinity, 22],
      passthrough: {},
    };
    const patch = makePatch([badBox], []);
    const result = validateGraph(patch);
    const e6 = result.diagnostics.filter((d) => d.code === "S001");
    expect(e6).toHaveLength(1);
    expect(e6[0].message).toContain("JSON");
  });

  it("emits multiple E002 and E003 when multiple lines are dangling", () => {
    const patch = makePatch(
      [makeBox("obj-1", 0, 2)],
      [
        makeLine("obj-1", 0, "obj-missing-a", 0),
        makeLine("obj-missing-b", 0, "obj-1", 0),
      ],
    );
    const result = validateGraph(patch);
    expect(
      result.diagnostics
        .filter((d) => d.code === "E003")
        .map((d) => d.location?.destId),
    ).toContain("obj-missing-a");
    expect(
      result.diagnostics
        .filter((d) => d.code === "E002")
        .map((d) => d.location?.sourceId),
    ).toContain("obj-missing-b");
  });
});
