import { afterEach, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runCli } from "../cli/run.js";
import {
  readAmxd,
  validateGraph,
  writeAmxd,
  createMaxForLiveDevice,
  applyNativePresentation,
  diffPatches,
} from "../index.js";
vi.mock("node:fs", async (original) => {
  const actual = await original<typeof fs>();
  return {
    ...actual,
    linkSync: vi.fn(actual.linkSync),
    writeFileSync: vi.fn(actual.writeFileSync),
    unlinkSync: vi.fn(actual.unlinkSync),
  };
});
const actual = await vi.importActual<typeof fs>("node:fs");
const dirs: string[] = [];
afterEach(() => {
  vi.mocked(fs.unlinkSync).mockReset().mockImplementation(actual.unlinkSync);
  vi.mocked(fs.linkSync).mockReset().mockImplementation(actual.linkSync);
  vi.mocked(fs.writeFileSync)
    .mockReset()
    .mockImplementation(actual.writeFileSync);
  for (const dir of dirs.splice(0))
    fs.rmSync(dir, { recursive: true, force: true });
});
function setup() {
  const dir = fs.mkdtempSync(join(tmpdir(), "maxpat-create-"));
  dirs.push(dir);
  return { dir, file: (name: string) => join(dir, name) };
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
it.each(["audio", "midi", "instrument"] as const)(
  "creates %s with a valid graph, project, type and basename",
  (type) => {
    const { file } = setup();
    const output = file("My Device.amxd");
    expect(cli("create", type, output)).toMatchObject({
      status: 0,
      value: {
        schemaVersion: 1,
        command: "create",
        operation: "create",
        ok: true,
        type,
        output,
        name: "My Device",
      },
    });
    const device = readAmxd(output);
    expect(device.type).toBe(type);
    expect(validateGraph(device.patch).ok).toBe(true);
    expect(device.patch.patcherMeta.passthrough.title).toBe("My Device");
    expect(
      diffPatches(
        device.patch,
        applyNativePresentation(
          createMaxForLiveDevice({ type, name: "My Device" }),
        ).patch,
      ).equal,
    ).toBe(true);
  },
);
it("supports explicit Unicode names and the shared playable sine template", () => {
  const { file } = setup();
  const output = file("Synth.amxd");
  expect(
    cli(
      "--name",
      "café 🎛️",
      "create",
      "instrument",
      output,
      "--template",
      "sine",
    ).status,
  ).toBe(0);
  const device = readAmxd(output);
  expect(device.patch.patcherMeta.passthrough.title).toBe("café 🎛️");
  expect(device.patch.boxes.get("oscillator")?.passthrough.text).toBe("cycle~");
  expect(device.patch.lines.filter((l) => l.sourceId === "level").length).toBe(
    2,
  );
  expect(validateGraph(device.patch).ok).toBe(true);
});
it("refuses existing output, permits --force and leaves no temporary files", () => {
  const { file, dir } = setup();
  const output = file("Existing.amxd");
  fs.writeFileSync(output, "keep");
  expect(cli("create", "audio", output)).toMatchObject({
    status: 2,
    value: {
      error: { code: "EEXIST", message: expect.stringContaining("--force") },
    },
  });
  expect(fs.readFileSync(output, "utf8")).toBe("keep");
  expect(cli("create", "audio", output, "--force").status).toBe(0);
  expect(readAmxd(output).type).toBe("audio");
  expect(fs.readdirSync(dir)).toEqual(["Existing.amxd"]);
});
it("cannot clobber a file created after the initial existence check", () => {
  const { file, dir } = setup();
  const output = file("Raced.amxd");
  vi.mocked(fs.linkSync).mockImplementationOnce((source, dest) => {
    actual.writeFileSync(dest, "other writer");
    actual.linkSync(source, dest);
  });
  expect(cli("create", "audio", output)).toMatchObject({
    status: 2,
    value: {
      error: { code: "EEXIST", message: expect.stringContaining("--force") },
    },
  });
  expect(fs.readFileSync(output, "utf8")).toBe("other writer");
  expect(fs.readdirSync(dir)).toEqual(["Raced.amxd"]);
});
it("preserves existing atomic failure behavior before installation", () => {
  const { file, dir } = setup();
  const output = file("Failure.amxd");
  vi.mocked(fs.writeFileSync).mockImplementationOnce(() => {
    throw new Error("disk full");
  });
  expect(cli("create", "audio", output).status).toBe(2);
  expect(fs.existsSync(output)).toBe(false);
  expect(fs.readdirSync(dir)).toEqual([]);
  writeAmxd(output, createMaxForLiveDevice({ type: "audio" }));
  const before = fs.readFileSync(output);
  vi.mocked(fs.writeFileSync).mockImplementationOnce(() => {
    throw new Error("disk full");
  });
  expect(cli("create", "midi", output, "--force").status).toBe(2);
  expect(fs.readFileSync(output)).toEqual(before);
});
it("rejects invocation mistakes before writing and has focused help", () => {
  const { file, dir } = setup();
  for (const args of [
    ["create", "audio"],
    ["create", "unknown", file("no.amxd")],
    ["create", "audio", file("no.maxpat")],
    ["create", "audio", file("no.amxd"), "--template", "sine"],
    ["create", "instrument", file("no.amxd"), "--template", "unknown"],
    ["create", "audio", file("no.amxd"), "--name", " "],
    ["create", "audio", file("no.amxd"), "--name"],
    ["check", file("no.amxd"), "--force"],
  ])
    expect(cli(...args).status).toBe(2);
  expect(fs.readdirSync(dir)).toEqual([]);
  expect(cli("create", "--help").value.help).toContain("--force");
});

it("recognises committed output when a temporary cleanup retry succeeds", () => {
  const { file, dir } = setup();
  vi.mocked(fs.unlinkSync).mockImplementationOnce(() => {
    throw Object.assign(new Error("busy"), { code: "EACCES" });
  });
  expect(cli("create", "audio", file("Committed.amxd")).status).toBe(0);
  expect(readAmxd(file("Committed.amxd")).type).toBe("audio");
  expect(fs.readdirSync(dir)).toEqual(["Committed.amxd"]);
});
it("reports persistent post-commit cleanup failure accurately", () => {
  const { file } = setup();
  const fail = () => {
    throw Object.assign(new Error("busy"), { code: "EACCES" });
  };
  vi.mocked(fs.unlinkSync)
    .mockImplementationOnce(fail)
    .mockImplementationOnce(fail);
  expect(cli("create", "audio", file("Committed.amxd"))).toMatchObject({
    status: 2,
    value: {
      error: { message: expect.stringContaining("Destination created") },
    },
  });
  expect(readAmxd(file("Committed.amxd")).type).toBe("audio");
});

it.each(["audio", "midi", "instrument"] as const)(
  "retains the original %s scaffold with --bare",
  (type) => {
    const { file } = setup(),
      output = file("Bare.amxd");
    expect(cli("create", type, output, "--bare").status).toBe(0);
    expect(
      diffPatches(
        readAmxd(output).patch,
        createMaxForLiveDevice({ type, name: "Bare" }).patch,
      ).equal,
    ).toBe(true);
  },
);
it("accepts a bare sine template but rejects --bare on other commands", () => {
  const { file } = setup(),
    output = file("Bare sine.amxd");
  expect(
    cli("create", "instrument", output, "--template", "sine", "--bare").status,
  ).toBe(0);
  expect(
    [...readAmxd(output).patch.boxes.values()].some(
      (b) => b.maxclass === "panel",
    ),
  ).toBe(false);
  expect(cli("inspect", output, "--bare").status).toBe(2);
  expect(cli("--version", "--bare").status).toBe(2);
});
