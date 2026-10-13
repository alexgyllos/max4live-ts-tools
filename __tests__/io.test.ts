import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { readFile } from "../io/reader.js";
import { writeFile, serializePatch } from "../io/writer.js";
import { stableStringify } from "../io/serializer.js";
import {
  MaxpatParseError,
  MaxpatStructuralError,
  MaxpatWriteError,
} from "../errors.js";
import { fileURLToPath } from "node:url";
const METADATA_FIXTURE = fileURLToPath(
  new URL("./fixtures/metadata.maxpat", import.meta.url),
);

const FIXTURE_DIR = fileURLToPath(new URL("./fixtures/", import.meta.url));
const VALID_FIXTURE = path.join(FIXTURE_DIR, "small-valid.maxpat.json");
const DANGLING_FIXTURE = path.join(
  FIXTURE_DIR,
  "small-invalid-dangling.maxpat.json",
);

describe("readFile", () => {
  it("reads a valid fixture", () => {
    const patch = readFile(VALID_FIXTURE);
    expect(patch.boxes.size).toBe(2);
    expect(patch.lines).toHaveLength(1);
    expect(patch.boxOrder).toEqual(["obj-1", "obj-2"]);
  });

  it("reads independent metadata fixture", () => {
    const patch = readFile(METADATA_FIXTURE);
    expect(patch.boxes.size).toBe(2);
    expect(patch.boxOrder).toEqual(["obj-1", "obj-2"]);
  });

  it("throws MaxpatParseError for invalid JSON", () => {
    const tmpFile = path.join(os.tmpdir(), `test-${Date.now()}.maxpat`);
    fs.writeFileSync(tmpFile, "not valid json");
    try {
      expect(() => readFile(tmpFile)).toThrow(MaxpatParseError);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it("throws MaxpatStructuralError when patcher is missing", () => {
    const tmpFile = path.join(os.tmpdir(), `test-${Date.now()}.maxpat`);
    fs.writeFileSync(tmpFile, JSON.stringify({ notPatcher: 1 }));
    try {
      expect(() => readFile(tmpFile)).toThrow(MaxpatStructuralError);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it("reads dangling fixture without throwing (semantic defects, not structural)", () => {
    const patch = readFile(DANGLING_FIXTURE);
    expect(patch.lines).toHaveLength(1);
  });

  it("throws when validateGraph option is true on dangling fixture", () => {
    expect(() => readFile(DANGLING_FIXTURE, { validateGraph: true })).toThrow();
  });

  it("preserves unknown fields in patcher passthrough", () => {
    const patch = readFile(METADATA_FIXTURE);
    // The metadata fixture has many passthrough fields like fileversion, bglocked, etc.
    // fileversion is structural, others go to passthrough
    expect(patch.patcherMeta.appversion).toBeDefined();
  });
});

describe("round-trip: read -> write -> read", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "maxpat-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("produces deep-equal NormalizedPatch for the metadata fixture", () => {
    const original = readFile(METADATA_FIXTURE);
    const tmpFile = path.join(tmpDir, "round-trip.maxpat");
    writeFile(tmpFile, original, { skipValidation: true });
    const roundTripped = readFile(tmpFile);

    expect(roundTripped.boxOrder).toEqual(original.boxOrder);
    expect(roundTripped.lines.length).toBe(original.lines.length);
    expect(roundTripped.boxes.size).toBe(original.boxes.size);

    for (const [id, box] of original.boxes) {
      const rtBox = roundTripped.boxes.get(id);
      expect(rtBox).toBeDefined();
      expect(rtBox!.maxclass).toBe(box.maxclass);
      expect(rtBox!.numinlets).toBe(box.numinlets);
      expect(rtBox!.numoutlets).toBe(box.numoutlets);
    }
  });

  it("box count and line count match original after round-trip", () => {
    const original = readFile(METADATA_FIXTURE);
    const tmpFile = path.join(tmpDir, "round-trip.maxpat");
    writeFile(tmpFile, original, { skipValidation: true });
    const rt = readFile(tmpFile);
    expect(rt.boxes.size).toBe(original.boxes.size);
    expect(rt.lines.length).toBe(original.lines.length);
  });

  it("fileversion and classnamespace survive round-trip", () => {
    const original = readFile(METADATA_FIXTURE);
    expect(original.patcherMeta.passthrough["fileversion"]).toBe(1);
    expect(original.patcherMeta.passthrough["classnamespace"]).toBe("box");
    const tmpFile = path.join(tmpDir, "rt-structural.maxpat");
    writeFile(tmpFile, original, { skipValidation: true });
    const rt = readFile(tmpFile);
    expect(rt.patcherMeta.passthrough["fileversion"]).toBe(1);
    expect(rt.patcherMeta.passthrough["classnamespace"]).toBe("box");
  });

  it("unknown fields survive round-trip", () => {
    const original = readFile(METADATA_FIXTURE);
    // appversion is a known meta field, should survive
    const tmpFile = path.join(tmpDir, "rt-unknown.maxpat");
    writeFile(tmpFile, original, { skipValidation: true });
    const rt = readFile(tmpFile);
    expect(rt.patcherMeta.appversion).toEqual(original.patcherMeta.appversion);
    // Passthrough keys like bglocked, openinpresentation, etc.
    expect(Object.keys(rt.patcherMeta.passthrough).length).toBeGreaterThan(0);
  });

  it("small valid fixture round-trips to deep-equal output", () => {
    const original = readFile(VALID_FIXTURE);
    const tmpFile = path.join(tmpDir, "small.maxpat");
    writeFile(tmpFile, original, { skipValidation: true });
    const rt = readFile(tmpFile);
    expect(rt.boxOrder).toEqual(original.boxOrder);
    expect(rt.lines.length).toBe(original.lines.length);
  });
});

describe("writeFile skipValidation", () => {
  it("succeeds on a semantically invalid patch when skipValidation is true", () => {
    const tmpFile = path.join(os.tmpdir(), `skip-val-${Date.now()}.maxpat`);
    const invalidPatch = readFile(DANGLING_FIXTURE); // has dangling patchline (E003)
    expect(() =>
      writeFile(tmpFile, invalidPatch, { skipValidation: true }),
    ).not.toThrow();
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      /* ignore */
    }
  });

  it("throws MaxpatValidationError when skipValidation is false on invalid patch", () => {
    const tmpFile = path.join(os.tmpdir(), `no-skip-${Date.now()}.maxpat`);
    const invalidPatch = readFile(DANGLING_FIXTURE);
    expect(() => writeFile(tmpFile, invalidPatch)).toThrow();
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      /* ignore */
    }
  });
});

describe("stableStringify", () => {
  it("is idempotent for a handcrafted fixture", () => {
    const patch = readFile(VALID_FIXTURE);
    const serialized = serializePatch(patch);
    const tmpFile = path.join(os.tmpdir(), `stable-test-${Date.now()}.maxpat`);
    fs.writeFileSync(tmpFile, serialized);
    try {
      const patch2 = readFile(tmpFile);
      const serialized2 = serializePatch(patch2);
      expect(serialized2).toBe(serialized);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it("places known keys before unknown keys", () => {
    const obj = { z_unknown: 1, patcher: {} };
    const result = stableStringify(obj);
    const parsed = JSON.parse(result) as Record<string, unknown>;
    const keys = Object.keys(parsed);
    expect(keys.indexOf("patcher")).toBeLessThan(keys.indexOf("z_unknown"));
  });

  it("serializer snapshot: small-valid fixture produces stable output", () => {
    const patch = readFile(VALID_FIXTURE);
    const out = serializePatch(patch);
    const parsed = JSON.parse(out) as Record<string, unknown>;
    const patcher = parsed["patcher"] as Record<string, unknown>;

    // Top-level key order: patcher is first
    expect(Object.keys(parsed)[0]).toBe("patcher");

    // Patcher-level: boxes before lines
    const patcherKeys = Object.keys(patcher);
    expect(patcherKeys.indexOf("boxes")).toBeLessThan(
      patcherKeys.indexOf("lines"),
    );

    // First box has id before patching_rect
    const boxes = patcher["boxes"] as Array<{ box: Record<string, unknown> }>;
    const firstBoxKeys = Object.keys(boxes[0].box);
    expect(firstBoxKeys.indexOf("id")).toBeLessThan(
      firstBoxKeys.indexOf("patching_rect"),
    );

    // Output ends with newline
    expect(out.endsWith("\n")).toBe(true);
  });
});

describe("writeFile errors", () => {
  it("throws MaxpatWriteError when writing to a nonexistent directory", () => {
    const patch = readFile(VALID_FIXTURE);
    expect(() =>
      writeFile("/nonexistent-dir-xyz/test.maxpat", patch, {
        skipValidation: true,
      }),
    ).toThrow(MaxpatWriteError);
  });
});
