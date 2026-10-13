import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import * as crypto from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parsePatch,
  parsePatchObject,
  serializePatch,
  toPatchObject,
} from "../io/parse.js";
import { writeFile } from "../io/writer.js";
import { readFile } from "../io/reader.js";
import { MaxpatWriteError, MaxpatStructuralError } from "../errors.js";
vi.mock("node:fs", async (original) => {
  const actual = await original<typeof fs>();
  return {
    ...actual,
    openSync: vi.fn(actual.openSync),
    writeFileSync: vi.fn(actual.writeFileSync),
    closeSync: vi.fn(actual.closeSync),
    renameSync: vi.fn(actual.renameSync),
    unlinkSync: vi.fn(actual.unlinkSync),
  };
});
vi.mock("node:crypto", async (original) => {
  const actual = await original<typeof crypto>();
  return { ...actual, randomUUID: vi.fn(actual.randomUUID) };
});
let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(join(tmpdir(), "maxpat-safety-"));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(fs.openSync).mockReset();
  vi.mocked(fs.openSync).mockImplementation(fsActual.openSync);
  vi.mocked(fs.writeFileSync).mockReset();
  vi.mocked(fs.writeFileSync).mockImplementation(fsActual.writeFileSync);
  vi.mocked(fs.closeSync).mockReset();
  vi.mocked(fs.closeSync).mockImplementation(fsActual.closeSync);
  vi.mocked(fs.renameSync).mockReset();
  vi.mocked(fs.renameSync).mockImplementation(fsActual.renameSync);
  vi.mocked(fs.unlinkSync).mockReset();
  vi.mocked(fs.unlinkSync).mockImplementation(fsActual.unlinkSync);
  vi.mocked(crypto.randomUUID).mockReset();
  vi.mocked(crypto.randomUUID).mockImplementation(cryptoActual.randomUUID);
  fs.rmSync(dir, { recursive: true, force: true });
});
const fsActual = await vi.importActual<typeof fs>("node:fs");
const cryptoActual = await vi.importActual<typeof crypto>("node:crypto");
const empty = () => parsePatchObject({ patcher: { boxes: [] } });
describe("lossless boundaries", () => {
  it("preserves every field, wrapper and absence of lines", () => {
    const raw = JSON.parse(
      fs.readFileSync(
        fileURLToPath(new URL("./fixtures/metadata.maxpat", import.meta.url)),
        "utf8",
      ),
    );
    expect(toPatchObject(parsePatchObject(raw))).toEqual(raw);
    const noLines = { patcher: { boxes: [], extra: { value: 1 } }, future: [] };
    expect(JSON.parse(serializePatch(parsePatchObject(noLines)))).toEqual(
      noLines,
    );
    const target = join(dir, "roundtrip.maxpat");
    writeFile(target, parsePatchObject(raw));
    expect(toPatchObject(readFile(target))).toEqual(raw);
    expect(
      serializePatch(parsePatch(serializePatch(parsePatchObject(raw)))),
    ).toBe(serializePatch(parsePatchObject(raw)));
  });
  it("preserves prototype-like JSON keys without polluting prototypes", () => {
    const raw = JSON.parse(
      '{"__proto__":{"sentinel":true},"patcher":{"boxes":[],"constructor":2}}',
    );
    expect(toPatchObject(parsePatchObject(raw))).toEqual(raw);
    expect(JSON.parse(serializePatch(parsePatchObject(raw)))).toEqual(raw);
    expect(({} as Record<string, unknown>).sentinel).toBeUndefined();
  });
  it("rejects duplicates recursively and every serialization bypass", () => {
    const box = {
      id: "a",
      maxclass: "button",
      numinlets: 1,
      numoutlets: 1,
      patching_rect: [0, 0, 20, 20],
    };
    expect(() =>
      parsePatchObject({ patcher: { boxes: [{ box }, { box }] } }),
    ).toThrow(/Duplicate/);
    expect(() =>
      parsePatchObject({
        patcher: {
          boxes: [{ box: { ...box, patcher: { boxes: [{ box }, { box }] } } }],
        },
      }),
    ).toThrow(/Duplicate/);
    const p = empty();
    p.duplicateBoxIds = ["a"];
    expect(() => serializePatch(p, { skipValidation: true })).toThrow();
    expect(() =>
      writeFile(join(dir, "bad.maxpat"), p, { skipValidation: true }),
    ).toThrow();
    expect(fs.readdirSync(dir)).toEqual([]);
  });
  it.each([NaN, Infinity, undefined, () => 1, 1n, new Date()])(
    "rejects non-JSON metadata %s",
    (v) => {
      expect(() =>
        parsePatchObject({ patcher: { boxes: [], value: v } }),
      ).toThrow(MaxpatStructuralError);
      const p = empty();
      p.patcherMeta.passthrough.value = v;
      expect(() => serializePatch(p, { skipValidation: true })).toThrow(
        MaxpatStructuralError,
      );
    },
  );
  it("rejects cycles, getters, sparse arrays and excessive depth", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const getter = {
      get x() {
        throw new Error("getter invoked");
      },
    };
    let deep: unknown = {};
    for (let i = 0; i < 130; i++) deep = { deep };
    for (const bad of [cyclic, getter, Array(2), deep])
      expect(() => parsePatchObject({ patcher: { boxes: [], bad } })).toThrow(
        MaxpatStructuralError,
      );
  });
  it("checks normalized metadata before any spread or getter evaluation", () => {
    for (const metadata of [
      new Date(),
      Object.defineProperty({}, "hidden", { value: 1 }),
      {
        get x() {
          throw new Error("getter ran");
        },
      },
    ]) {
      const p = empty();
      p.patcherMeta.passthrough = metadata as Record<string, unknown>;
      expect(() => serializePatch(p, { skipValidation: true })).toThrow(
        MaxpatStructuralError,
      );
    }
    const arr: unknown[] = [];
    Object.defineProperty(arr, "4294967295", {
      get() {
        throw new Error("getter ran");
      },
      enumerable: true,
    });
    expect(() =>
      parsePatchObject({ patcher: { boxes: [], extra: arr } }),
    ).toThrow(MaxpatStructuralError);
  });
  it("handles a BOM and rejects invalid UTF-8", () => {
    expect(parsePatch('\uFEFF{"patcher":{"boxes":[]}}').boxes.size).toBe(0);
    const f = join(dir, "bad.maxpat");
    fs.writeFileSync(f, Buffer.from([0xff]));
    expect(() => readFile(f)).toThrow(/UTF-8/);
  });
  it("rejects inconsistent map/order and negative rectangle dimensions", () => {
    const p = empty();
    p.boxOrder = ["missing"];
    expect(() => serializePatch(p, { skipValidation: true })).toThrow(
      /boxOrder/,
    );
    expect(() =>
      parsePatchObject({ patcher: { boxes: [], rect: [0, 0, -1, 10] } }),
    ).toThrow();
  });
});
describe("atomic writer", () => {
  it("repeated writes leave one complete file and no temporary files", () => {
    const target = join(dir, "a.maxpat");
    for (let i = 0; i < 100; i++) writeFile(target, empty());
    expect(fs.readdirSync(dir)).toEqual(["a.maxpat"]);
    expect(readFile(target).boxes.size).toBe(0);
    if (process.platform !== "win32")
      expect(fs.statSync(target).mode & 0o777).toBe(0o600);
  });
  it("preserves existing POSIX permissions", () => {
    const target = join(dir, "a.maxpat");
    fs.writeFileSync(target, "original");
    fs.chmodSync(target, 0o640);
    writeFile(target, empty());
    if (process.platform !== "win32")
      expect(fs.statSync(target).mode & 0o777).toBe(0o640);
  });
  it.each(["write", "close", "rename", "permission"])(
    "preserves original and cleans up on %s failure",
    (stage) => {
      const target = join(dir, "a.maxpat");
      fs.writeFileSync(target, "original");
      const error = Object.assign(new Error("injected fault"), {
        code: "EACCES",
      });
      if (stage === "write")
        vi.mocked(fs.writeFileSync).mockImplementationOnce(() => {
          throw error;
        });
      if (stage === "close")
        vi.mocked(fs.closeSync).mockImplementationOnce(() => {
          throw error;
        });
      if (stage === "rename")
        vi.mocked(fs.renameSync).mockImplementationOnce(() => {
          throw error;
        });
      if (stage === "permission")
        vi.mocked(fs.openSync).mockImplementationOnce(() => {
          throw error;
        });
      try {
        writeFile(target, empty());
        throw new Error("expected failure");
      } catch (e) {
        expect(e).toBeInstanceOf(MaxpatWriteError);
        expect((e as Error).cause).toBe(error);
      }
      expect(fs.readFileSync(target, "utf8")).toBe("original");
      expect(fs.readdirSync(dir)).toEqual(["a.maxpat"]);
      if (stage !== "permission") expect(fs.closeSync).toHaveBeenCalled();
    },
  );
  it("reports cleanup errors without replacing original", () => {
    const target = join(dir, "a.maxpat");
    fs.writeFileSync(target, "original");
    vi.mocked(fs.renameSync).mockImplementationOnce(() => {
      throw new Error("rename");
    });
    vi.mocked(fs.unlinkSync).mockImplementationOnce(() => {
      throw new Error("unlink");
    });
    try {
      writeFile(target, empty());
    } catch (e) {
      expect((e as Error).cause).toBeInstanceOf(AggregateError);
    }
    expect(fs.readFileSync(target, "utf8")).toBe("original");
  });
  it("retries collisions without truncating someone else's temporary file", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const collision = join(dir, `.maxpat-${id}.tmp`);
    fs.writeFileSync(collision, "owned by someone else");
    vi.mocked(crypto.randomUUID).mockReturnValueOnce(id);
    writeFile(join(dir, "a.maxpat"), empty());
    expect(fs.readFileSync(collision, "utf8")).toBe("owned by someone else");
  });
  it("rejects symlink destinations and missing directories", () => {
    const target = join(dir, "a.maxpat");
    fs.writeFileSync(target, "original");
    if (process.platform !== "win32") {
      const link = join(dir, "link.maxpat");
      fs.symlinkSync(target, link);
      expect(() => writeFile(link, empty())).toThrow(MaxpatWriteError);
      expect(fs.readFileSync(target, "utf8")).toBe("original");
    }
    expect(() => writeFile(join(dir, "missing", "a.maxpat"), empty())).toThrow(
      MaxpatWriteError,
    );
  });
});
it("bounds a large source before reading and closes the descriptor", () => {
  const file = join(dir, "large.maxpat");
  const fd = fs.openSync(file, "w");
  fs.ftruncateSync(fd, 40 * 1024 * 1024 + 1);
  fs.closeSync(fd);
  const before = vi.mocked(fs.closeSync).mock.calls.length;
  expect(() => readFile(file)).toThrow(/bounded/);
  expect(vi.mocked(fs.closeSync).mock.calls.length).toBe(before + 1);
});
