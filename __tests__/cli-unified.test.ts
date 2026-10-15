import { afterEach, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { encodeRaw } from "@tsln/amxd";
import {
  createMaxForLiveDevice,
  encodeAmxd,
  readAmxd,
  writeAmxd,
  writeFile,
  PatchEditor,
  PatchBuilder,
  toPatchObject,
} from "../index.js";
import { runCli } from "../cli/run.js";
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});
function setup() {
  const dir = mkdtempSync(join(tmpdir(), "maxpat-cli-"));
  dirs.push(dir);
  const file = (name: string) => join(dir, name);
  const device = createMaxForLiveDevice({
    type: "audio",
    name: "Stereo Effect",
  });
  writeAmxd(file("audio.amxd"), device);
  writeFile(file("patch.maxpat"), device.patch);
  return { file, device };
}
function cli(...args: string[]) {
  let stdout = "",
    stderr = "";
  const status = runCli([...args, "--json"], "test", {
    stdout: (t) => (stdout += t),
    stderr: (t) => (stderr += t),
  });
  expect(stdout && stderr).toBe("");
  return { status, value: JSON.parse(stdout || stderr) };
}
it("inspects both formats with recursive totals and retains the amxd alias fields", () => {
  const { file } = setup();
  for (const args of [
    ["inspect", file("audio.amxd")],
    ["amxd", "inspect", file("audio.amxd")],
  ]) {
    expect(cli(...args)).toMatchObject({
      status: 0,
      value: {
        schemaVersion: 1,
        format: "amxd",
        type: "audio",
        containerVersion: 4,
        name: "Stereo Effect",
        boxes: 2,
        connections: 2,
        nestedPatchers: 0,
        validation: { ok: true },
        patcher: { boxes: 2, connections: 2, scopes: 1 },
      },
    });
  }
  expect(cli("inspect", file("patch.maxpat"))).toMatchObject({
    status: 0,
    value: { format: "maxpat", boxes: 2, validation: { ok: true } },
  });
  const nested = new URL(
    "./fixtures/audio-nested-max-9.1.5.amxd",
    import.meta.url,
  );
  const result = cli("inspect", fileURLToPath(nested));
  expect(result.value.nestedPatchers).toBeGreaterThan(0);
  expect(result.value.boxes).toBeGreaterThan(result.value.patcher.boxes);
});
it("detects devices by header, diagnoses mismatches, malformed and unsupported inputs", () => {
  const { file, device } = setup();
  writeFileSync(file("device.bin"), encodeAmxd(device));
  expect(cli("check", file("device.bin")).status).toBe(0);
  writeFileSync(file("device.maxpat"), encodeAmxd(device));
  expect(cli("check", file("device.maxpat"))).toMatchObject({
    status: 2,
    value: { error: { code: "FORMAT_MISMATCH" } },
  });
  for (const [name, bytes, code] of [
    ["frozen.amxd", Buffer.from("mx@c"), "UNSUPPORTED_AMXD"],
    [
      "encrypted.amxd",
      encodeRaw({
        version: 4,
        meta: 0,
        type: "audio",
        text: "{}",
        chunks: [{ tag: "ciph", data: new Uint8Array() }],
      }),
      "UNSUPPORTED_AMXD",
    ],
    ["bad.amxd", Buffer.from('{"patcher":{"boxes":[]}}'), "MALFORMED_AMXD"],
    ["truncated.amxd", Buffer.from("ampf"), "MALFORMED_AMXD"],
    ["unknown.bin", Buffer.from("????"), "UNKNOWN_FORMAT"],
  ] as const) {
    writeFileSync(file(name), bytes);
    expect(cli("check", file(name))).toMatchObject({
      status: 2,
      value: { ok: false, error: { code } },
    });
  }
  const newer = encodeAmxd(device);
  new DataView(newer.buffer).setUint32(4, 5, true);
  writeFileSync(file("new.amxd"), newer);
  expect(cli("check", file("new.amxd"))).toMatchObject({
    status: 2,
    value: { error: { code: "UNSUPPORTED_AMXD" } },
  });
});
it("validates device graphs without imposing build preflight, including nested graph errors", () => {
  const { file, device } = setup();
  device.patch.lines[0].destId = "missing";
  writeAmxd(file("broken.amxd"), device, { skipValidation: true });
  for (const command of ["check", "validate"]) {
    const result = cli(command, file("broken.amxd"));
    expect(result.status).toBe(1);
    expect(result.value.ok).toBe(false);
    expect(
      result.value.diagnostics.some((d: { code: string }) => d.code === "E003"),
    ).toBe(true);
  }
  const abstract = { ...device, patch: new PatchBuilder().toNormalized() };
  // Valid supported patchers need not contain known built-in I/O or project data.
  writeAmxd(file("abstract.amxd"), abstract);
  expect(cli("check", file("abstract.amxd")).status).toBe(0);
  const raw = toPatchObject(createMaxForLiveDevice({ type: "audio" }).patch);
  raw.patcher.boxes[0].box.patcher = {
    boxes: [],
    lines: [
      { patchline: { source: ["absent", 0], destination: ["missing", 0] } },
    ],
  };
  writeFileSync(
    file("nested.amxd"),
    encodeRaw({
      version: 4,
      meta: 0,
      chunks: [],
      type: "audio",
      text: JSON.stringify(raw),
    }),
  );
  const nested = cli("check", file("nested.amxd"));
  expect(nested.status).toBe(1);
  expect(
    nested.value.diagnostics.some(
      (d: { location?: { path: string } }) => d.location?.path,
    ),
  ).toBe(true);
});
it("keeps structural failures distinct from graph diagnostics and checks declared device metadata", () => {
  const { file, device } = setup();
  const raw = toPatchObject(device.patch);
  raw.patcher.boxes.push(structuredClone(raw.patcher.boxes[0]));
  writeFileSync(
    file("duplicates.amxd"),
    encodeRaw({
      version: 4,
      meta: 0,
      chunks: [],
      type: "audio",
      text: JSON.stringify(raw),
    }),
  );
  expect(cli("check", file("duplicates.amxd"))).toMatchObject({
    status: 1,
    value: {
      error: {
        name: "MaxpatValidationError",
        diagnostics: [
          {
            code: "E001",
            severity: "error",
            message: expect.any(String),
            location: { boxId: "input" },
          },
        ],
      },
    },
  });
  writeFileSync(
    file("malformed.amxd"),
    encodeRaw({
      version: 4,
      meta: 0,
      chunks: [],
      type: "audio",
      text: JSON.stringify({ patcher: { boxes: [{ box: { id: "x" } }] } }),
    }),
  );
  expect(cli("check", file("malformed.amxd"))).toMatchObject({
    status: 2,
    value: { error: { name: "MaxpatStructuralError" } },
  });
  const mismatch = toPatchObject(device.patch);
  (mismatch.patcher.project as Record<string, unknown>).amxdtype = 1;
  writeFileSync(
    file("mismatch.amxd"),
    encodeRaw({
      version: 4,
      meta: 0,
      chunks: [],
      type: "audio",
      text: JSON.stringify(mismatch),
    }),
  );
  expect(cli("check", file("mismatch.amxd"))).toMatchObject({
    status: 2,
    value: { error: { code: "MALFORMED_AMXD" } },
  });
});
it("compares devices to extracted JSON, ignores payload whitespace and separates container changes", () => {
  const { file, device } = setup();
  expect(cli("diff", file("audio.amxd"), file("patch.maxpat"))).toEqual({
    status: 0,
    value: {
      schemaVersion: 1,
      command: "diff",
      mode: "structural",
      equal: true,
      changes: [],
    },
  });
  const original = readAmxd(file("audio.amxd"));
  const pretty = encodeRaw({
    version: 4,
    meta: 0,
    chunks: [],
    type: "audio",
    text: JSON.stringify(toPatchObject(device.patch)),
  });
  writeFileSync(file("pretty.amxd"), pretty);
  expect(
    cli("diff", file("audio.amxd"), file("pretty.amxd"), "--include-container")
      .value,
  ).toMatchObject({ equal: true, container: { equal: true, changes: [] } });
  original.container!.meta = 3;
  original.container!.chunks = [
    ...original.container!.chunks,
    { tag: "test", data: Uint8Array.of(1, 2) },
  ];
  writeAmxd(file("metadata.amxd"), original);
  expect(cli("diff", file("audio.amxd"), file("metadata.amxd")).status).toBe(0);
  expect(
    cli(
      "diff",
      file("audio.amxd"),
      file("metadata.amxd"),
      "--include-container",
    ),
  ).toMatchObject({
    status: 1,
    value: { equal: false, changes: [], container: { equal: false } },
  });
  original.patch = PatchEditor.fromNormalized(original.patch)
    .updateBox("input", { passthrough: { text: "plugin~", custom: { a: 1 } } })
    .toNormalized();
  writeAmxd(file("edited.amxd"), original);
  const changed = cli(
    "diff",
    file("metadata.amxd"),
    file("edited.amxd"),
    "--include-container",
  );
  expect(changed.status).toBe(1);
  expect(changed.value.changes.length).toBeGreaterThan(0);
  expect(changed.value.container.equal).toBe(true);
  expect(
    cli("diff", file("audio.amxd"), file("patch.maxpat"), "--include-container")
      .status,
  ).toBe(2);
});
it("compares chunk order, duplicate occurrences, bytes and device type", () => {
  const { file, device } = setup();
  const a = readAmxd(file("audio.amxd"));
  a.container!.chunks = [
    { tag: "test", data: Uint8Array.of(1) },
    ...a.container!.chunks,
    { tag: "test", data: Uint8Array.of(2) },
  ];
  writeAmxd(file("a.amxd"), a);
  a.container!.chunks = [...a.container!.chunks].reverse();
  writeAmxd(file("b.amxd"), a);
  expect(
    cli("diff", file("a.amxd"), file("b.amxd"), "--include-container"),
  ).toMatchObject({
    status: 1,
    value: { changes: [], container: { equal: false } },
  });
  const raw = toPatchObject(device.patch);
  delete raw.patcher.project;
  for (const type of ["audio", "midi"] as const)
    writeFileSync(
      file(`${type}-type.amxd`),
      encodeRaw({
        version: 4,
        meta: 0,
        chunks: [],
        type,
        text: JSON.stringify(raw),
      }),
    );
  expect(
    cli(
      "diff",
      file("audio-type.amxd"),
      file("midi-type.amxd"),
      "--include-container",
    ).value.container.changes,
  ).toContainEqual({
    kind: "updated",
    path: "/container/type",
    before: "audio",
    after: "midi",
  });
});
it("has command-specific help, preserves option ordering and respects --", () => {
  const { file } = setup();
  for (const command of [
    "inspect",
    "diff",
    "check",
    "validate",
    "amxd",
    "format",
  ]) {
    const result = cli(command, "--help");
    expect(result.status).toBe(0);
    expect(result.value.help).toContain(`maxpat ${command}`);
    if (command !== "format")
      expect(result.value.help).not.toContain("--write");
  }
  expect(cli("--json", "check", file("audio.amxd")).status).toBe(0);
  expect(cli("inspect", "--write", file("audio.amxd")).status).toBe(2);
  expect(cli("check", "--include-container", file("audio.amxd")).status).toBe(
    2,
  );
  let output = "";
  expect(
    runCli(["check", "--", "--json"], "test", {
      stdout: (t) => (output += t),
      stderr: (t) => (output += t),
    }),
  ).toBe(2);
  expect(output).not.toContain("schemaVersion");
});

it("reports bounded byte-based summaries for large opaque chunks", () => {
  const { file } = setup();
  const device = readAmxd(file("audio.amxd"));
  const payload = Buffer.alloc(2 * 1024 * 1024, 97);
  device.container!.chunks = [
    ...device.container!.chunks,
    { tag: "blob", data: payload },
  ];
  writeAmxd(file("large-a.amxd"), device);
  payload[payload.length - 1] = 98;
  writeAmxd(file("large-b.amxd"), device);
  const result = cli(
    "diff",
    file("large-a.amxd"),
    file("large-b.amxd"),
    "--include-container",
  );
  expect(result.status).toBe(1);
  expect(result.value.changes).toEqual([]);
  expect(result.value.container.changes).toEqual([
    {
      kind: "updated",
      path: "/container/chunks/2",
      before: {
        index: 2,
        tag: "blob",
        size: payload.length,
        sha256Prefix: expect.stringMatching(/^[0-9a-f]{16}$/),
      },
      after: {
        index: 2,
        tag: "blob",
        size: payload.length,
        sha256Prefix: expect.stringMatching(/^[0-9a-f]{16}$/),
      },
    },
  ]);
  expect(result.value.container.changes[0].before.sha256Prefix).not.toBe(
    result.value.container.changes[0].after.sha256Prefix,
  );
  expect(JSON.stringify(result.value).length).toBeLessThan(1000);
  let text = "";
  expect(
    runCli(
      [
        "diff",
        file("large-a.amxd"),
        file("large-b.amxd"),
        "--include-container",
      ],
      "test",
      { stdout: (t) => (text += t), stderr: (t) => (text += t) },
    ),
  ).toBe(1);
  expect(text.length).toBeLessThan(1000);
});
