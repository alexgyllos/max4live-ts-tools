import { describe, it, expect } from "vitest";
import { RawMaxpatSchema } from "../schema/raw-maxpat.js";
import { RawBoxWrapperSchema } from "../schema/raw-box.js";
import { RawPatchlineWrapperSchema } from "../schema/raw-patchline.js";

describe("RawMaxpatSchema", () => {
  it("parses a minimal valid patch", () => {
    const input = {
      patcher: {
        boxes: [],
        lines: [],
      },
    };
    const result = RawMaxpatSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("survives unknown patcher fields", () => {
    const input = {
      patcher: {
        boxes: [],
        lines: [],
        fileversion: 1,
        appversion: { major: 9 },
        customField: "preserved",
      },
    };
    const result = RawMaxpatSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(
        (result.data.patcher as Record<string, unknown>)["customField"],
      ).toBe("preserved");
    }
  });

  it("fails when patcher is missing", () => {
    const result = RawMaxpatSchema.safeParse({ other: 1 });
    expect(result.success).toBe(false);
  });

  it("fails when lines contains an item without patchline key", () => {
    const input = {
      patcher: {
        boxes: [],
        lines: [{ notAPatchline: {} }],
      },
    };
    const result = RawMaxpatSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("accepts missing lines field", () => {
    const input = { patcher: { boxes: [] } };
    const result = RawMaxpatSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});

describe("RawBoxWrapperSchema", () => {
  it("parses a valid box wrapper", () => {
    const input = {
      box: {
        id: "obj-1",
        maxclass: "newobj",
        numinlets: 1,
        numoutlets: 1,
        patching_rect: [10, 20, 80, 22],
      },
    };
    const result = RawBoxWrapperSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("fails when box is missing id", () => {
    const input = {
      box: {
        maxclass: "newobj",
        numinlets: 1,
        numoutlets: 1,
        patching_rect: [10, 20, 80, 22],
      },
    };
    const result = RawBoxWrapperSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map(
        (i) => i.message + " " + i.path.join("."),
      );
      expect(
        messages.some(
          (m) => m.includes("id") || m.toLowerCase().includes("required"),
        ),
      ).toBe(true);
    }
  });

  it("fails when numinlets is negative", () => {
    const input = {
      box: {
        id: "obj-1",
        maxclass: "newobj",
        numinlets: -1,
        numoutlets: 0,
        patching_rect: [0, 0, 80, 22],
      },
    };
    const result = RawBoxWrapperSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("fails when numoutlets is negative", () => {
    const input = {
      box: {
        id: "obj-1",
        maxclass: "newobj",
        numinlets: 0,
        numoutlets: -1,
        patching_rect: [0, 0, 80, 22],
      },
    };
    const result = RawBoxWrapperSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("accepts unknown maxclass", () => {
    const input = {
      box: {
        id: "obj-1",
        maxclass: "some.unknown.class",
        numinlets: 0,
        numoutlets: 1,
        patching_rect: [0, 0, 60, 20],
      },
    };
    const result = RawBoxWrapperSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("preserves unknown box fields via passthrough", () => {
    const input = {
      box: {
        id: "obj-10",
        maxclass: "newobj",
        text: "node.script foo.js",
        varname: "mybox",
        numinlets: 1,
        numoutlets: 1,
        patching_rect: [0, 0, 80, 22],
        saved_object_attributes: { autostart: 1 },
      },
    };
    const result = RawBoxWrapperSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      const box = result.data.box as Record<string, unknown>;
      expect(box["varname"]).toBe("mybox");
      expect(box["saved_object_attributes"]).toEqual({ autostart: 1 });
    }
  });
});

describe("RawPatchlineWrapperSchema", () => {
  it("parses a valid patchline wrapper", () => {
    const input = {
      patchline: {
        source: ["obj-1", 0],
        destination: ["obj-2", 0],
      },
    };
    const result = RawPatchlineWrapperSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("fails when source tuple has wrong arity", () => {
    const input = {
      patchline: {
        source: ["obj-1"],
        destination: ["obj-2", 0],
      },
    };
    const result = RawPatchlineWrapperSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });

  it("fails when destination tuple has wrong arity", () => {
    const input = {
      patchline: {
        source: ["obj-1", 0],
        destination: ["obj-2"],
      },
    };
    const result = RawPatchlineWrapperSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("fails when wrapper has no patchline key", () => {
    const result = RawPatchlineWrapperSchema.safeParse({ notPatchline: {} });
    expect(result.success).toBe(false);
  });
});
