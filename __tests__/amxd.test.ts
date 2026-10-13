import { describe, expect, it, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { encodeRaw } from "@tsln/amxd";
import {
  createMaxForLiveDevice,
  decodeAmxd,
  encodeAmxd,
  readAmxd,
  writeAmxd,
  PatchEditor,
  parsePatchObject,
  serializePatch,
  diffPatches,
  MaxpatWriteError,
  AmxdError,
} from "../index.js";
import { runCli } from "../cli/run.js";
vi.mock("node:fs", async (original) => {
  const actual = await original<typeof fs>();
  return {
    ...actual,
    renameSync: vi.fn(actual.renameSync),
    writeFileSync: vi.fn(actual.writeFileSync),
  };
});
const actual = await vi.importActual<typeof fs>("node:fs");
const dirs: string[] = [];
const directory = () => {
  const dir = fs.mkdtempSync(join(tmpdir(), "amxd-test-"));
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  vi.mocked(fs.renameSync).mockReset().mockImplementation(actual.renameSync);
  vi.mocked(fs.writeFileSync)
    .mockReset()
    .mockImplementation(actual.writeFileSync);
  for (const dir of dirs.splice(0))
    fs.rmSync(dir, { recursive: true, force: true });
});
const raw = (text = '{"patcher":{"boxes":[],"lines":[]}}') =>
  encodeRaw({ version: 4, type: "audio", meta: 1, chunks: [], text });
// Independent chunk framing for deliberately unusual containers.
const chunk = (tag: string, data: Uint8Array) => {
  const b = Buffer.alloc(8 + data.length);
  b.write(tag, 0, "ascii");
  b.writeUInt32LE(data.length, 4);
  b.set(data, 8);
  return b;
};
const unusual = (payload: Uint8Array) =>
  Buffer.concat([
    Buffer.from("ampf\x04\0\0\0aaaa", "binary"),
    chunk("pre!", Uint8Array.from([0, 255, 3])),
    chunk("ptch", payload),
    chunk("meta", Uint8Array.from([1, 0, 0, 0])),
    chunk("post", Uint8Array.from([9, 8])),
    chunk("post", Uint8Array.from([7])),
  ]);
describe("amxd container adapter", () => {
  // Fixtures were authored with this library and saved by Max 9.1.5 in Live 12.4.6.
  it.each([
    "audio-passthrough",
    "midi-passthrough",
    "sine-instrument",
    "audio-nested",
  ])("round-trips the native Max-saved %s fixture byte-identically", (name) => {
    const bytes = fs.readFileSync(
      fileURLToPath(
        new URL(`./fixtures/${name}-max-9.1.5.amxd`, import.meta.url),
      ),
    );
    const device = decodeAmxd(bytes, { validateGraph: true });
    expect(device.patch.patcherMeta.appversion).toMatchObject({
      major: 9,
      minor: 1,
      revision: 5,
    });
    expect(encodeAmxd(device)).toEqual(Uint8Array.from(bytes));
  });

  it("creates complete project dictionaries required by Max's loader", () => {
    const project = createMaxForLiveDevice({ type: "audio" }).patch.patcherMeta
      .passthrough.project;
    expect(project).toMatchObject({
      searchpath: {},
      layout: {},
      contents: { patchers: {} },
    });
  });
  it.each(["audio", "midi", "instrument"] as const)(
    "encodes and decodes %s with UTF-8 lengths",
    (type) => {
      const device = createMaxForLiveDevice({ type, name: "東京 🎛️ – café" });
      const bytes = encodeAmxd(device);
      expect(Buffer.from(bytes.subarray(0, 4)).toString()).toBe("ampf");
      expect(new DataView(bytes.buffer).getUint32(4, true)).toBe(4);
      expect(new DataView(bytes.buffer).getUint32(28, true)).toBe(
        new TextEncoder().encode(serializePatch(device.patch)).length + 1,
      );
      const result = decodeAmxd(bytes);
      expect(result.type).toBe(type);
      expect(diffPatches(device.patch, result.patch).equal).toBe(true);
      expect(result.patch.patcherMeta.passthrough.title).toBe("東京 🎛️ – café");
    },
  );

  it("edits the genuine nested fixture while retaining parameter metadata and ordered connections", () => {
    const source = fs.readFileSync(
      fileURLToPath(
        new URL("./fixtures/audio-nested-max-9.1.5.amxd", import.meta.url),
      ),
    );
    const device = decodeAmxd(source);
    const patch = PatchEditor.fromNormalized(device.patch)
      .editAtPath(["details"], (child) =>
        child.updateBox("message-a", { passthrough: { text: "revised" } }),
      )
      .toNormalized();
    const result = decodeAmxd(encodeAmxd({ ...device, patch }));
    expect(result.patch.patcherMeta.passthrough.parameters).toEqual(
      device.patch.patcherMeta.passthrough.parameters,
    );
    expect(
      result.patch.boxes.get("level")!.passthrough.saved_attribute_attributes,
    ).toEqual(
      device.patch.boxes.get("level")!.passthrough.saved_attribute_attributes,
    );
    const child = PatchEditor.fromNormalized(result.patch).atPath(["details"]);
    expect(child.findById("message-a")!.passthrough.text).toBe("revised");
    expect(child.toNormalized().lines).toEqual(
      PatchEditor.fromNormalized(device.patch)
        .atPath(["details"])
        .toNormalized().lines,
    );
  });
  it.each(["\0", "\0\0", ""])(
    "preserves unchanged raw text, NUL padding and every chunk position (%j)",
    (tail) => {
      const text =
        '{ "patcher": { "boxes": [], "lines": [], "unknown": -0.0 } }\r\n';
      const source = unusual(Buffer.from(text + tail));
      const device = decodeAmxd(source);
      expect(device.container!.chunks.map((c) => c.tag)).toEqual([
        "pre!",
        "ptch",
        "meta",
        "post",
        "post",
      ]);
      expect(encodeAmxd(device)).toEqual(Uint8Array.from(source));
      source.fill(0);
      expect(encodeAmxd(device)[0]).toBe(97);
    },
  );
  it("preserves opaque chunks and meta while editing nested patch attributes", () => {
    const nested = {
      patcher: {
        boxes: [
          {
            box: {
              id: "nested",
              maxclass: "newobj",
              numinlets: 0,
              numoutlets: 0,
              patching_rect: [0, 0, 80, 22],
              patcher: { boxes: [], custom: { saved: 42 } },
            },
          },
        ],
        lines: [],
        future: "value",
      },
      root: "metadata",
    };
    const original = unusual(Buffer.from(JSON.stringify(nested) + "\0"));
    const device = decodeAmxd(original);
    const patch = PatchEditor.fromNormalized(device.patch)
      .editAtPath(["nested"], (child) =>
        child.withMetadata({ passthrough: { edited: true } }),
      )
      .toNormalized();
    const result = decodeAmxd(encodeAmxd({ ...device, patch }));
    expect(result.container!.meta).toBe(1);
    expect(result.container!.chunks.map((c) => c.tag)).toEqual(
      device.container!.chunks.map((c) => c.tag),
    );
    for (const i of [0, 3, 4])
      expect(result.container!.chunks[i].data).toEqual(
        device.container!.chunks[i].data,
      );
    expect(result.patch.rootPassthrough).toEqual({ root: "metadata" });
    expect(result.patch.boxes.get("nested")!.passthrough.patcher).toMatchObject(
      { custom: { saved: 42 }, edited: true },
    );
  });
  it("changes explicit container metadata without altering patch bytes", () => {
    const device = decodeAmxd(raw());
    const changed = {
      ...device,
      type: "midi" as const,
      container: { ...device.container!, meta: 0xffffffff },
    };
    const result = decodeAmxd(encodeAmxd(changed));
    expect(result.type).toBe("midi");
    expect(result.container!.meta).toBe(0xffffffff);
    expect(
      result.container!.chunks.find((c) => c.tag === "ptch")!.data,
    ).toEqual(device.container!.chunks.find((c) => c.tag === "ptch")!.data);
  });
  it.each([0, 4, 11, 13, 19, 25, 31, 35])(
    "rejects truncation at byte %i",
    (end) => {
      expect(() => decodeAmxd(raw().subarray(0, end))).toThrow(AmxdError);
    },
  );
  it("rejects oversized lengths, repeated known chunks and invalid UTF-8", () => {
    const b = raw();
    new DataView(b.buffer).setUint32(28, 0xffffffff, true);
    expect(() => decodeAmxd(b)).toThrow(/past the end/);
    expect(() =>
      decodeAmxd(Buffer.concat([raw(), chunk("ptch", Buffer.from("{}\0"))])),
    ).toThrow(/one ptch/);
    expect(() =>
      decodeAmxd(Buffer.concat([raw(), chunk("meta", Buffer.alloc(4))])),
    ).toThrow(/one ptch/);
    expect(() => decodeAmxd(unusual(Uint8Array.from([255, 0])))).toThrow(
      /UTF-8/,
    );
    expect(() => decodeAmxd(unusual(Buffer.from("not JSON\0")))).toThrow(
      /Invalid JSON/,
    );
  });
  it("rejects unknown versions/types and explicit frozen archives", () => {
    const version = raw();
    new DataView(version.buffer).setUint32(4, 5, true);
    expect(() => decodeAmxd(version)).toThrow(/version 4/);
    const type = raw();
    type.set(Buffer.from("xxxx"), 8);
    expect(() => decodeAmxd(type)).toThrow(/Invalid .amxd container/);
    for (const bytes of [
      Buffer.from("mx@c archive"),
      unusual(Buffer.from("mx@c archive\0")),
      Buffer.concat([raw(), chunk("mx@c", Buffer.from("archive"))]),
    ]) {
      try {
        decodeAmxd(bytes);
        throw new Error("Expected failure");
      } catch (e) {
        expect(e).toBeInstanceOf(AmxdError);
        expect((e as AmxdError).code).toBe("UNSUPPORTED_AMXD");
      }
    }
  });
  it("bounds binary input and oversized caller-supplied chunk metadata", () => {
    const oversized = new Uint8Array(64 * 1024 * 1024 + 1);
    expect(() => decodeAmxd(oversized)).toThrow(/64 MiB/);
    const device = decodeAmxd(raw());
    expect(() =>
      encodeAmxd({
        ...device,
        container: {
          ...device.container!,
          chunks: [
            ...device.container!.chunks,
            { tag: "extra".slice(0, 4), data: oversized },
          ],
        },
      }),
    ).toThrow(/64 MiB/);
  });
  it("rejects encrypted ciph variants explicitly", () => {
    const bytes = Buffer.concat([
      raw(),
      chunk("ciph", Buffer.from("encrypted")),
    ]);
    expect(() => decodeAmxd(bytes)).toThrow(/Encrypted ciph/);
  });
  it("validates graph output and container numbers before encoding", () => {
    const device = createMaxForLiveDevice({ type: "audio" });
    device.patch.lines[0].destId = "missing";
    expect(() => encodeAmxd(device)).toThrow(/validation errors/);
    const empty = decodeAmxd(raw());
    for (const meta of [-1, 1.5, NaN, 0x100000000])
      expect(() =>
        encodeAmxd({ ...empty, container: { ...empty.container!, meta } }),
      ).toThrow(/uint32/);
    expect(() =>
      encodeAmxd({
        ...empty,
        container: {
          ...empty.container!,
          chunks: [{ tag: "ptch", data: Buffer.from("{}") }],
        },
      }),
    ).toThrow(/one ptch/);
  });
});
describe("binary file replacement and CLI", () => {
  it.each(["searchpath", "layout", "contents"])(
    "rejects an incomplete Max project (%s) before replacing a file",
    (key) => {
      const dir = directory(),
        path = join(dir, "original.amxd");
      fs.writeFileSync(path, "original");
      const device = createMaxForLiveDevice({ type: "audio" });
      delete (
        device.patch.patcherMeta.passthrough.project as Record<string, unknown>
      )[key];
      expect(() => writeAmxd(path, device)).toThrow(/project metadata/);
      expect(fs.readFileSync(path, "utf8")).toBe("original");
      expect(fs.readdirSync(dir)).toEqual(["original.amxd"]);
    },
  );

  it("writes devices using the existing file replacement behaviour", () => {
    const path = join(directory(), "effect.amxd");
    const device = createMaxForLiveDevice({ type: "audio" });
    writeAmxd(path, device);
    expect(readAmxd(path).type).toBe("audio");
    if (process.platform !== "win32")
      expect(fs.statSync(path).mode & 0o777).toBe(0o600);
    device.patch.lines[0].destId = "missing";
    const original = fs.readFileSync(path);
    expect(() => writeAmxd(path, device)).toThrow();
    expect(fs.readFileSync(path)).toEqual(original);
    expect(fs.readdirSync(join(path, ".."))).toEqual(["effect.amxd"]);
  });
  it.each(["write", "rename"])(
    "retains original device and cleans the temp after %s failure",
    (stage) => {
      const dir = directory(),
        path = join(dir, "effect.amxd");
      fs.writeFileSync(path, "original");
      const failure = new Error("injected binary failure");
      if (stage === "write")
        vi.mocked(fs.writeFileSync).mockImplementationOnce(() => {
          throw failure;
        });
      else
        vi.mocked(fs.renameSync).mockImplementationOnce(() => {
          throw failure;
        });
      try {
        writeAmxd(path, createMaxForLiveDevice({ type: "midi" }));
        throw new Error("Expected failure");
      } catch (e) {
        expect(e).toBeInstanceOf(MaxpatWriteError);
        expect((e as Error).cause).toBe(failure);
      }
      expect(fs.readFileSync(path, "utf8")).toBe("original");
      expect(fs.readdirSync(dir)).toEqual(["effect.amxd"]);
    },
  );
  it.each(["audio", "midi", "instrument"])(
    "builds, inspects and extracts %s devices",
    (type) => {
      const dir = directory(),
        input = join(dir, "source.maxpat"),
        output = join(dir, "device.amxd"),
        extracted = join(dir, "extracted.maxpat");
      fs.writeFileSync(
        input,
        serializePatch(
          parsePatchObject({ patcher: { boxes: [], custom: "café" } }),
        ),
      );
      const cli = (args: string[]) => {
        let stdout = "",
          stderr = "";
        const exit = runCli(args, "test", {
          stdout: (t) => (stdout += t),
          stderr: (t) => (stderr += t),
        });
        return { exit, stdout, stderr };
      };
      expect(
        cli(["amxd", "build", input, output, "--type", type, "--json"]).exit,
      ).toBe(0);
      const inspect = cli(["--json", "amxd", "inspect", output]);
      expect(inspect.stderr).toBe("");
      expect(JSON.parse(inspect.stdout)).toMatchObject({
        schemaVersion: 1,
        operation: "inspect",
        type,
        containerVersion: 4,
        patcher: { boxes: 0, connections: 0, scopes: 1 },
      });
      expect(cli(["amxd", "extract", output, extracted]).exit).toBe(0);
      expect(fs.readFileSync(extracted, "utf8")).toBe(
        fs.readFileSync(input, "utf8"),
      );
      for (const args of [
        ["amxd", "build", input, output],
        ["amxd", "build", input, output, "--type", "unknown"],
        ["amxd", "extract", output],
        ["amxd", "inspect", output, "--type", "midi"],
        ["amxd", "inspect", output, "--write"],
        ["amxd", "inspect", "missing.amxd"],
      ])
        expect(cli(["--json", ...args]).exit).toBe(2);
      const before = fs.readFileSync(output);
      fs.writeFileSync(input, "not JSON");
      const error = cli([
        "--json",
        "amxd",
        "build",
        input,
        output,
        "--type",
        type,
      ]);
      expect(error.exit).toBe(2);
      expect(error.stdout).toBe("");
      expect(JSON.parse(error.stderr)).toMatchObject({
        schemaVersion: 1,
        ok: false,
      });
      expect(fs.readFileSync(output)).toEqual(before);
    },
  );
});
