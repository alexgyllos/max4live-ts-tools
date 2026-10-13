import { describe, it, expect } from "vitest";
import { PatchEditor, PatchBuilder } from "../editor/index.js";
import type { NormalizedPatch } from "../types.js";

const emptyPatch = (): NormalizedPatch => ({
  patcherMeta: { passthrough: {} },
  boxes: new Map(),
  lines: [],
  boxOrder: [],
  duplicateBoxIds: [],
});

const withBoxes = (): NormalizedPatch => ({
  patcherMeta: { passthrough: {} },
  boxes: new Map([
    [
      "obj-1",
      {
        id: "obj-1",
        maxclass: "newobj",
        numinlets: 0,
        numoutlets: 1,
        patchingRect: [0, 0, 80, 22],
        passthrough: { text: "loadbang" },
      },
    ],
    [
      "obj-2",
      {
        id: "obj-2",
        maxclass: "newobj",
        numinlets: 1,
        numoutlets: 0,
        patchingRect: [0, 60, 60, 22],
        passthrough: { text: "print" },
      },
    ],
    [
      "obj-3",
      {
        id: "obj-3",
        maxclass: "newobj",
        numinlets: 1,
        numoutlets: 1,
        patchingRect: [0, 120, 80, 22],
        passthrough: { varname: "myobj" },
      },
    ],
  ]),
  lines: [
    {
      sourceId: "obj-1",
      sourceOutlet: 0,
      destId: "obj-2",
      destInlet: 0,
      passthrough: {},
    },
  ],
  boxOrder: ["obj-1", "obj-2", "obj-3"],
  duplicateBoxIds: [],
});

describe("PatchEditor", () => {
  describe("addBox", () => {
    it("assigns deterministic ID and preserves original editor", () => {
      const original = PatchEditor.fromNormalized(withBoxes());
      const updated = original.addBox({
        maxclass: "button",
        numinlets: 1,
        numoutlets: 1,
        patchingRect: [0, 160, 24, 24],
      });

      // original unchanged
      expect(original.toNormalized().boxes.size).toBe(3);
      // updated has new box
      expect(updated.toNormalized().boxes.size).toBe(4);

      const newIds = [...updated.toNormalized().boxes.keys()].filter(
        (id) => !original.toNormalized().boxes.has(id),
      );
      expect(newIds).toHaveLength(1);
      expect(newIds[0]).toMatch(/^obj-\d+$/);
      // ID is higher than existing max
      expect(parseInt(newIds[0].replace("obj-", ""), 10)).toBeGreaterThan(3);
    });

    it("sequential addBox calls each produce unique IDs", () => {
      let editor = PatchEditor.fromNormalized(emptyPatch());
      const spec = {
        maxclass: "newobj",
        numinlets: 1,
        numoutlets: 1,
        patchingRect: [0, 0, 80, 22] as const,
      };
      editor = editor.addBox(spec);
      editor = editor.addBox(spec);
      editor = editor.addBox(spec);
      const ids = [...editor.toNormalized().boxes.keys()];
      expect(new Set(ids).size).toBe(3);
    });
  });

  describe("updateBox", () => {
    it("updates allowed fields and preserves passthrough", () => {
      const original = PatchEditor.fromNormalized(withBoxes());
      const updated = original.updateBox("obj-1", { numinlets: 1 });

      expect(original.findById("obj-1")!.numinlets).toBe(0);
      expect(updated.findById("obj-1")!.numinlets).toBe(1);
      // passthrough preserved
      expect(updated.findById("obj-1")!.passthrough["text"]).toBe("loadbang");
    });

    it("merges passthrough updates without dropping existing keys", () => {
      const original = PatchEditor.fromNormalized(withBoxes());
      const updated = original.updateBox("obj-1", {
        passthrough: { extra: true },
      });
      expect(updated.findById("obj-1")!.passthrough["text"]).toBe("loadbang");
      expect(updated.findById("obj-1")!.passthrough["extra"]).toBe(true);
    });

    it("throws when box not found", () => {
      const editor = PatchEditor.fromNormalized(withBoxes());
      expect(() => editor.updateBox("obj-999", { numinlets: 1 })).toThrow(
        /not found/,
      );
    });
  });

  describe("removeBox", () => {
    it("removes box and attached lines", () => {
      const original = PatchEditor.fromNormalized(withBoxes());
      const updated = original.removeBox("obj-1");

      expect(updated.findById("obj-1")).toBeUndefined();
      expect(updated.toNormalized().lines).toHaveLength(0); // the line connected obj-1
    });

    it("preserves original editor", () => {
      const original = PatchEditor.fromNormalized(withBoxes());
      original.removeBox("obj-2");
      expect(original.toNormalized().boxes.size).toBe(3);
    });
  });

  describe("connect", () => {
    it("adds a patchline between two boxes", () => {
      const editor = PatchEditor.fromNormalized(withBoxes());
      const updated = editor.connect(["obj-1", 0], ["obj-3", 0]);
      const lines = updated.toNormalized().lines;
      expect(lines).toHaveLength(2);
    });

    it("is idempotent when called with duplicate endpoints", () => {
      const editor = PatchEditor.fromNormalized(withBoxes());
      const once = editor.connect(["obj-1", 0], ["obj-3", 0]);
      const twice = once.connect(["obj-1", 0], ["obj-3", 0]);
      expect(twice.toNormalized().lines).toHaveLength(2);
    });
  });

  describe("disconnect", () => {
    it("removes only the matching line", () => {
      const editor = PatchEditor.fromNormalized(withBoxes());
      const updated = editor.disconnect(["obj-1", 0], ["obj-2", 0]);
      expect(updated.toNormalized().lines).toHaveLength(0);
      // Original unchanged
      expect(editor.toNormalized().lines).toHaveLength(1);
    });

    it("no-ops when no connection matches", () => {
      const editor = PatchEditor.fromNormalized(withBoxes());
      expect(
        editor.disconnect(["obj-99", 0], ["obj-2", 0]).toNormalized().lines,
      ).toHaveLength(1);
    });
  });

  describe("findByClass / findByText / findByVarname", () => {
    it("findByClass returns boxes in boxOrder", () => {
      const editor = PatchEditor.fromNormalized(withBoxes());
      const results = editor.findByClass("newobj");
      expect(results.map((b) => b.id)).toEqual(["obj-1", "obj-2", "obj-3"]);
    });

    it("findByText returns matching boxes", () => {
      const editor = PatchEditor.fromNormalized(withBoxes());
      const results = editor.findByText("print");
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("obj-2");
    });

    it("findByVarname returns matching boxes", () => {
      const editor = PatchEditor.fromNormalized(withBoxes());
      const results = editor.findByVarname("myobj");
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("obj-3");
    });
  });

  describe("linesFrom / linesTo", () => {
    it("linesFrom returns only lines where box is source", () => {
      const editor = PatchEditor.fromNormalized(withBoxes());
      expect(editor.linesFrom("obj-1")).toHaveLength(1);
      expect(editor.linesFrom("obj-1")[0].destId).toBe("obj-2");
    });

    it("linesTo returns only lines where box is destination", () => {
      const editor = PatchEditor.fromNormalized(withBoxes());
      expect(editor.linesTo("obj-2")).toHaveLength(1);
      expect(editor.linesTo("obj-2")[0].sourceId).toBe("obj-1");
    });

    it("linesFrom returns empty array when box has no outgoing lines", () => {
      const editor = PatchEditor.fromNormalized(withBoxes());
      expect(editor.linesFrom("obj-2")).toHaveLength(0);
    });
  });

  describe("write validation", () => {
    it("validateOrThrow throws on invalid graph", () => {
      const patch: NormalizedPatch = {
        patcherMeta: { passthrough: {} },
        boxes: new Map([
          [
            "obj-1",
            {
              id: "obj-1",
              maxclass: "newobj",
              numinlets: 0,
              numoutlets: 1,
              patchingRect: [0, 0, 80, 22],
              passthrough: {},
            },
          ],
        ]),
        lines: [
          {
            sourceId: "obj-1",
            sourceOutlet: 0,
            destId: "obj-999",
            destInlet: 0,
            passthrough: {},
          },
        ],
        boxOrder: ["obj-1"],
        duplicateBoxIds: [],
      };
      const editor = PatchEditor.fromNormalized(patch);
      expect(() => editor.validateOrThrow()).toThrow();
    });
  });

  describe("mutation integration", () => {
    it("addBox + connect + validate passes for a valid new connection", () => {
      const editor = PatchEditor.fromNormalized(withBoxes()).addBox({
        maxclass: "newobj",
        numinlets: 1,
        numoutlets: 1,
        patchingRect: [0, 200, 80, 22],
      });

      const ids = [...editor.toNormalized().boxes.keys()];
      const newId = ids.find(
        (id) => !["obj-1", "obj-2", "obj-3"].includes(id),
      )!;

      const connected = editor.connect(["obj-3", 0], [newId, 0]);
      const result = connected.validate();
      const errors = result.diagnostics.filter((d) => d.severity === "error");
      expect(errors).toHaveLength(0);
    });

    it("removeBox cascades: linesFrom and linesTo both empty after remove", () => {
      const editor = PatchEditor.fromNormalized(withBoxes());
      const after = editor.removeBox("obj-1");
      expect(after.linesFrom("obj-1")).toHaveLength(0);
      expect(after.linesTo("obj-2")).toHaveLength(0);
    });
  });

  describe("PatchBuilder", () => {
    it("creates a valid empty patch", () => {
      const builder = new PatchBuilder();
      const editor = builder.editor;
      const patch = editor.toNormalized();
      expect(patch.boxes.size).toBe(0);
      expect(patch.lines).toHaveLength(0);
      expect(patch.boxOrder).toHaveLength(0);
    });

    it("accepts rect and appversion options", () => {
      const builder = new PatchBuilder({
        rect: [0, 0, 600, 400],
        appversion: { major: 9 },
      });
      const meta = builder.editor.toNormalized().patcherMeta;
      expect(meta.rect).toEqual([0, 0, 600, 400]);
      expect(meta.appversion).toEqual({ major: 9 });
    });
  });
});
