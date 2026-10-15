import { afterEach, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import { join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  createMaxForLiveDevice,
  PatchEditor,
  writeAmxd,
  readAmxd,
  serializePatch,
  parsePatchObject,
} from "../index.js";
import { discover } from "../packaging/dependencies.js";
import { writePackage } from "../packaging/package.js";
import { runCli } from "../cli/run.js";
vi.mock("node:fs", async (original) => {
  const actual = await original<typeof fs>();
  return {
    ...actual,
    renameSync: vi.fn(actual.renameSync),
    writeFileSync: vi.fn(actual.writeFileSync),
    mkdirSync: vi.fn(actual.mkdirSync),
  };
});
const actual = await vi.importActual<typeof fs>("node:fs");
const dirs: string[] = [];
afterEach(() => {
  vi.mocked(fs.renameSync).mockReset().mockImplementation(actual.renameSync);
  vi.mocked(fs.writeFileSync)
    .mockReset()
    .mockImplementation(actual.writeFileSync);
  vi.mocked(fs.mkdirSync).mockReset().mockImplementation(actual.mkdirSync);
  for (const dir of dirs.splice(0))
    fs.rmSync(dir, { recursive: true, force: true });
});
function setup() {
  const dir = fs.realpathSync(
    fs.mkdtempSync(join(tmpdir(), "maxpat-package-test-")),
  );
  dirs.push(dir);
  const file = (name: string) => join(dir, name);
  function device(
    text = "v8 tempo.js",
    metadata: Record<string, unknown> = {},
  ) {
    const d = createMaxForLiveDevice({ type: "audio" });
    const e = PatchEditor.fromNormalized(d.patch)
      .addBox(
        {
          maxclass: "newobj",
          numinlets: 1,
          numoutlets: 1,
          patchingRect: [20, 80, 100, 22],
          passthrough: { text },
        },
        "script",
      )
      .withMetadata({ passthrough: metadata });
    writeAmxd(file("Device.amxd"), { ...d, patch: e.toNormalized() });
    return file("Device.amxd");
  }
  return { dir, file, device };
}
function cli(...args: string[]) {
  let out = "",
    err = "";
  const status = runCli([...args, "--json"], "test", {
    stdout: (t) => (out += t),
    stderr: (t) => (err += t),
  });
  expect(out && err).toBe("");
  return { status, value: JSON.parse(out || err) };
}
it("finds JavaScript, deduplicates repeated references and includes adjacent attribution", () => {
  const { file, device } = setup();
  fs.writeFileSync(file("tempo.js"), "outlets=1;");
  fs.writeFileSync(file("LICENSE.tsln"), "fixture licence");
  const input = device("v8 tempo.js", {
    dependency_cache: [
      {
        name: "tempo.js",
        type: "TEXT",
        bootpath: "/old/private/project",
        patcherrelativepath: ".",
      },
    ],
  });
  const d = discover(input);
  const script = d.dependencies.find((d) => d.reference === "tempo.js");
  expect(script).toMatchObject({ status: "resolved", destination: "tempo.js" });
  expect(script!.sources).toHaveLength(2);
  expect(
    d.dependencies.some(
      (d) => d.reference === "LICENSE.tsln" && d.status === "resolved",
    ),
  ).toBe(true);
  const report = cli("deps", input);
  expect(report.status).toBe(0);
  expect(report.value).toMatchObject({
    schemaVersion: 1,
    command: "deps",
    ok: true,
  });
});
it("reports missing and dynamic references separately without guessing global Max paths", () => {
  const { file, device } = setup();
  const input = device();
  expect(discover(input).dependencies[0].status).toBe("missing");
  expect(cli("deps", input).status).toBe(1);
  device("js #1");
  expect(discover(input).dependencies[0].status).toBe("unresolved");
  expect(cli("package", input, "--output", file("release")).status).toBe(1);
  expect(fs.existsSync(file("release"))).toBe(false);
});
it("handles quoted script names and extensionless scripts", () => {
  const { file, device } = setup();
  fs.writeFileSync(file("my script.js"), "");
  expect(discover(device('v8 "my script.js"')).dependencies[0].status).toBe(
    "resolved",
  );
  fs.writeFileSync(file("tempo.js"), "");
  expect(discover(device("js tempo")).dependencies[0].destination).toBe(
    "tempo.js",
  );
});
const staticDeclarations = [
  ["node.script engine.js", "engine.js", "javascript"],
  ["poly~ voice 8", "voice.maxpat", "patcher"],
  ["pfft~ spectrum 1024", "spectrum.maxpat", "patcher"],
  ['buffer~ sample @file "drum loop.wav"', "drum loop.wav", "media"],
  ["buffer~ sample @audiofile drums.wav", "drums.wav", "media"],
  ["poly~ @patchername voice @voices 8", "voice.maxpat", "patcher"],
] as const;
it.each(staticDeclarations)(
  "packages %s without a dependency cache",
  (text, name, kind) => {
    const { file, device } = setup();
    const input = device(text);
    expect(
      readAmxd(input).patch.patcherMeta.passthrough.dependency_cache,
    ).toBeUndefined();
    const bytes =
      kind === "patcher"
        ? '{"patcher":{"boxes":[{"box":{"id":"script","maxclass":"newobj","text":"js nested.js","numinlets":1,"numoutlets":1,"patching_rect":[0,0,100,22]}}]}}'
        : "fixture";
    fs.writeFileSync(file(name), bytes);
    fs.writeFileSync(file("nested.js"), "outlets=1;");
    const discovered = discover(input);
    expect(discovered.dependencies[0]).toMatchObject({
      status: "resolved",
      kind,
      destination: name,
    });
    const output = file("out");
    writePackage(discovered, output);
    const packaged = fs.readFileSync(join(output, name), "utf8");
    if (kind === "patcher") {
      expect(JSON.parse(packaged)).toEqual(JSON.parse(bytes));
      expect(fs.readFileSync(join(output, "nested.js"), "utf8")).toBe(
        "outlets=1;",
      );
    } else expect(packaged).toBe(bytes);
    expect(fs.readFileSync(file(name), "utf8")).toBe(bytes);
  },
);
it.each(staticDeclarations)("blocks packaging when %s is missing", (text) => {
  const { file, device } = setup();
  const input = device(text);
  expect(discover(input).dependencies[0].status).toBe("missing");
  expect(cli("package", input, "--output", file("out")).status).toBe(1);
  expect(fs.existsSync(file("out"))).toBe(false);
});
it.each([
  "node.script #1",
  "poly~ #1 8",
  "pfft~ #1 1024",
  "buffer~ sample @file #1",
  "node.script",
  "poly~",
  "pfft~",
  "buffer~ sample @file",
  "poly~ @patchername @voices 8",
])("reports %s as unresolved", (text) => {
  const { file, device } = setup();
  const input = device(text);
  expect(discover(input).dependencies[0].status).toBe("unresolved");
  expect(cli("package", input, "--output", file("out")).status).toBe(1);
  expect(fs.existsSync(file("out"))).toBe(false);
});
it.each(["scripts/engine.js", "scripts\\engine.js"])(
  "resolves and preserves the layout of %s on every host",
  (reference) => {
    const { file, device } = setup();
    fs.mkdirSync(file("scripts"));
    fs.writeFileSync(file("scripts/engine.js"), "fixture");
    const input = device(`node.script "${reference}"`);
    const report = discover(input);
    expect(report.dependencies[0]).toMatchObject({
      status: "resolved",
      destination: "scripts/engine.js",
    });
    writePackage(report, file("out"));
    expect(fs.readFileSync(file("out/scripts/engine.js"), "utf8")).toBe(
      "fixture",
    );
  },
);
it("normalises cache hints and extensionless patcher references consistently", () => {
  const { file, device } = setup();
  fs.mkdirSync(file("patchers.v1"));
  fs.mkdirSync(file("scripts"));
  fs.mkdirSync(file("scripts/nested"));
  fs.writeFileSync(
    file("patchers.v1/voice.maxpat"),
    '{"patcher":{"boxes":[]}}',
  );
  fs.writeFileSync(file("scripts/nested/engine.js"), "fixture");
  const input = device("poly~ patchers.v1\\voice 8", {
    dependency_cache: [
      { name: "engine.js", patcherrelativepath: "scripts\\nested" },
    ],
  });
  const report = discover(input);
  expect(report.dependencies.map((dep) => dep.status)).toEqual([
    "resolved",
    "resolved",
  ]);
  writePackage(report, file("out"));
  expect(fs.existsSync(file("out/patchers.v1/voice.maxpat"))).toBe(true);
  expect(fs.existsSync(file("out/engine.js"))).toBe(true);
});
it.each([
  "..\\outside.js",
  "C:\\outside.js",
  "\\\\server\\share\\outside.js",
  "\\outside.js",
])("blocks unsafe Windows reference %s on every host", (reference) => {
  const { file, device } = setup();
  const input = device(`node.script "${reference}"`);
  expect(discover(input).dependencies[0].status).not.toBe("resolved");
  expect(cli("package", input, "--output", file("out")).status).toBe(1);
  expect(fs.existsSync(file("out"))).toBe(false);
});
it("lists the new commands when rejecting an unknown command", () => {
  expect(cli("unknown").value.error.message).toContain("deps or package");
});
it("walks embedded scopes and recursively scans external abstractions", () => {
  const { file, device } = setup();
  fs.writeFileSync(file("helper.js"), "");
  fs.writeFileSync(
    file("controls.maxpat"),
    serializePatch(
      parsePatchObject({
        patcher: {
          boxes: [
            {
              box: {
                id: "nested",
                maxclass: "newobj",
                numinlets: 1,
                numoutlets: 1,
                patching_rect: [0, 0, 80, 22],
                text: "js helper.js",
              },
            },
          ],
        },
      }),
    ),
  );
  const nested = {
    boxes: [
      {
        box: {
          id: "bp",
          maxclass: "bpatcher",
          numinlets: 1,
          numoutlets: 1,
          patching_rect: [0, 0, 80, 22],
          name: "controls.maxpat",
        },
      },
    ],
  };
  const input = device("p embedded");
  const d = readAmxd(input);
  writeAmxd(input, {
    ...d,
    patch: PatchEditor.fromNormalized(d.patch)
      .updateBox("script", { passthrough: { patcher: nested } })
      .toNormalized(),
  });
  const deps = discover(input).dependencies;
  expect(
    deps.some((d) => d.reference === "controls.maxpat" && d.kind === "patcher"),
  ).toBe(true);
  expect(
    deps.some((d) => d.reference === "helper.js" && d.status === "resolved"),
  ).toBe(true);
});
it("recognises local unqualified abstractions but does not classify every built-in as missing", () => {
  const { file, device } = setup();
  fs.writeFileSync(file("controls.maxpat"), '{"patcher":{"boxes":[]}}');
  expect(discover(device("controls")).dependencies[0]).toMatchObject({
    reference: "controls",
    destination: "controls.maxpat",
  });
  expect(discover(device("pack 0. 10")).dependencies).toEqual([]);
});
it("uses explicit search roots and refuses ambiguous resolutions", () => {
  const { file, dir, device } = setup();
  const input = device();
  fs.mkdirSync(file("other"));
  fs.writeFileSync(file("other/tempo.js"), "secondary");
  expect(
    discover(input, { roots: [dir, file("other")] }).dependencies[0],
  ).toMatchObject({ status: "resolved", destination: "tempo.js" });
  writePackage(discover(input, { roots: [dir, file("other")] }), file("out"));
  expect(fs.readFileSync(file("out/tempo.js"), "utf8")).toBe("secondary");
  fs.writeFileSync(file("tempo.js"), "primary");
  expect(
    discover(input, { roots: [dir, file("other")] }).dependencies[0].status,
  ).toBe("ambiguous");
});
it("preserves relative directory relationships within a project root", () => {
  const { file, dir } = setup();
  fs.mkdirSync(file("devices"));
  fs.mkdirSync(file("scripts"));
  fs.writeFileSync(file("scripts/helper.js"), "");
  const d = createMaxForLiveDevice({ type: "audio" });
  const patch = PatchEditor.fromNormalized(d.patch)
    .addBox(
      {
        maxclass: "newobj",
        numinlets: 1,
        numoutlets: 1,
        patchingRect: [0, 0, 80, 22],
        passthrough: { text: "js ../scripts/helper.js" },
      },
      "js",
    )
    .toNormalized();
  writeAmxd(file("devices/Device.amxd"), { ...d, patch });
  const report = cli(
    "package",
    file("devices/Device.amxd"),
    "--root",
    dir,
    "--output",
    file("out"),
  );
  expect(report.status).toBe(0);
  expect(report.value.manifest.device).toBe("devices/Device.amxd");
  expect(fs.existsSync(file("out/scripts/helper.js"))).toBe(true);
});
it("does not traverse outside allowed roots or accept absolute runtime references", () => {
  const { file, dir, device } = setup();
  const parent = join(dir, "..", "outside.js");
  const input = device("js ../outside.js");
  expect(discover(input).dependencies[0].status).toBe("missing");
  expect(fs.existsSync(file("out"))).toBe(false);
  device(`js "${parent}"`);
  expect(discover(input).dependencies[0].status).toBe("unresolved");
});
it("detects project metadata and media references", () => {
  const { file, device } = setup();
  fs.writeFileSync(file("sample.wav"), "fixture");
  fs.writeFileSync(file("extra.js"), "");
  const d = readAmxd(device("buffer~ sample sample.wav"));
  const project = d.patch.patcherMeta.passthrough.project as Record<
    string,
    unknown
  >;
  writeAmxd(file("Device.amxd"), {
    ...d,
    patch: PatchEditor.fromNormalized(d.patch)
      .withMetadata({
        passthrough: {
          project: {
            ...project,
            contents: { code: { "extra.js": { kind: "javascript" } } },
          },
        },
      })
      .toNormalized(),
  });
  expect(
    discover(file("Device.amxd"))
      .dependencies.map((d) => d.reference)
      .sort(),
  ).toEqual(["extra.js", "sample.wav"]);
});
it("creates a verified manifest and leaves sources byte-identical while discarding stale cache hints", () => {
  const { file, device } = setup();
  fs.writeFileSync(file("tempo.js"), "source");
  const input = device("v8 tempo.js", {
    dependency_cache: [
      { name: "tempo.js", bootpath: "/private/development/path" },
    ],
  });
  const original = fs.readFileSync(input);
  const output = writePackage(discover(input), file("nested/release"));
  expect(output.warnings).toEqual([]);
  expect(fs.readFileSync(input)).toEqual(original);
  expect(
    readAmxd(file("nested/release/Device.amxd")).patch.patcherMeta.passthrough
      .dependency_cache,
  ).toBeUndefined();
  const manifest = JSON.parse(
    fs.readFileSync(file("nested/release/maxpat-package.json"), "utf8"),
  );
  expect(JSON.stringify(manifest)).not.toContain(file(""));
  for (const item of manifest.files) {
    const bytes = fs.readFileSync(file("nested/release/" + item.path));
    expect(bytes).toHaveLength(item.size);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(item.sha256);
  }
});
it("supports explicit assets and a dry run that writes no directories", () => {
  const { file, device } = setup();
  const input = device("live.thisdevice");
  fs.mkdirSync(file("media"));
  fs.writeFileSync(file("media/texture.png"), "asset");
  const args = [
    "package",
    input,
    "--asset",
    file("media/texture.png"),
    "--output",
    file("not-created/release"),
  ];
  const dry = cli(...args, "--dry-run");
  expect(dry.status).toBe(0);
  expect(dry.value.written).toBe(false);
  expect(fs.existsSync(file("not-created"))).toBe(false);
  expect(cli(...args).status).toBe(0);
  expect(
    fs.readFileSync(file("not-created/release/media/texture.png"), "utf8"),
  ).toBe("asset");
});
it("refuses an existing output by default and replaces only when explicitly requested", () => {
  const { file, device } = setup();
  const input = device("live.thisdevice");
  fs.mkdirSync(file("out"));
  fs.writeFileSync(file("out/old"), "preserve");
  expect(cli("package", input, "--output", file("out")).status).toBe(2);
  expect(fs.readFileSync(file("out/old"), "utf8")).toBe("preserve");
  expect(cli("package", input, "--output", file("out"), "--force").status).toBe(
    0,
  );
  expect(fs.existsSync(file("out/old"))).toBe(false);
});
it("refuses corrupted staged manifests before claiming output", () => {
  const { file, device } = setup();
  const input = device("live.thisdevice");
  const discovery = discover(input);
  vi.mocked(fs.writeFileSync).mockImplementation((...args) => {
    if (
      String(args[0]).includes(".maxpat-package-") &&
      String(args[0]).endsWith("maxpat-package.json")
    )
      return actual.writeFileSync(args[0], "corrupt");
    return actual.writeFileSync(...args);
  });
  expect(() => writePackage(discovery, file("out"))).toThrow(
    /manifest verification/,
  );
  expect(fs.existsSync(file("out"))).toBe(false);
});
it("bounds saved dependency-cache references before expanding the report", () => {
  const { device } = setup();
  const input = device("live.thisdevice", {
    dependency_cache: Array.from({ length: 4097 }, (_, i) => ({
      name: `file-${i}.js`,
    })),
  });
  expect(() => discover(input)).toThrow(/reference limit/);
});
it("cleans partial staging writes before an output exists", () => {
  const { file, dir, device } = setup();
  const input = device();
  fs.writeFileSync(file("tempo.js"), "");
  const discovery = discover(input);
  vi.mocked(fs.writeFileSync).mockImplementation((...args) => {
    if (
      String(args[0]).includes(".maxpat-package-") &&
      String(args[0]).endsWith("tempo.js")
    )
      throw new Error("disk full");
    return actual.writeFileSync(...args);
  });
  expect(() => writePackage(discovery, file("new/out"))).toThrow(/disk full/);
  expect(fs.existsSync(file("new"))).toBe(false);
  expect(fs.readdirSync(dir).some((n) => n.startsWith("."))).toBe(false);
});
it("rolls back failed publication and restores replaced output", () => {
  const { file, dir, device } = setup();
  const input = device();
  fs.writeFileSync(file("tempo.js"), "");
  fs.mkdirSync(file("out"));
  fs.writeFileSync(file("out/old"), "preserve");
  const discovery = discover(input);
  vi.mocked(fs.renameSync).mockImplementation((...args) => {
    if (
      String(args[0]).includes(".maxpat-package-") &&
      String(args[1]).endsWith(sep + "tempo.js")
    )
      throw new Error("move failure");
    return actual.renameSync(...args);
  });
  expect(() => writePackage(discovery, file("out"), true)).toThrow(
    /move failure/,
  );
  expect(fs.readFileSync(file("out/old"), "utf8")).toBe("preserve");
  expect(fs.readdirSync(dir).some((n) => n.startsWith("."))).toBe(false);
});
it("preserves old output and cleans an empty backup if the backup move fails", () => {
  const { file, dir, device } = setup();
  const input = device("live.thisdevice");
  fs.mkdirSync(file("out"));
  fs.writeFileSync(file("out/old"), "keep");
  vi.mocked(fs.renameSync).mockImplementation((...args) => {
    if (String(args[0]) === file("out")) throw new Error("backup move failure");
    return actual.renameSync(...args);
  });
  expect(() => writePackage(discover(input), file("out"), true)).toThrow(
    /backup move failure/,
  );
  expect(fs.readFileSync(file("out/old"), "utf8")).toBe("keep");
  expect(fs.readdirSync(dir).some((n) => n.startsWith("."))).toBe(false);
});
it("does not overwrite or remove an output created concurrently by someone else", () => {
  const { file, device } = setup();
  const input = device("live.thisdevice");
  const discovery = discover(input);
  const out = file("out");
  vi.mocked(fs.mkdirSync).mockImplementation((...args) => {
    if (String(args[0]) === out && !fs.existsSync(out)) {
      actual.mkdirSync(out);
      actual.writeFileSync(join(out, "other"), "keep");
    }
    return actual.mkdirSync(...args);
  });
  expect(() => writePackage(discovery, out)).toThrow();
  expect(fs.readFileSync(file("out/other"), "utf8")).toBe("keep");
});
it("rejects reserved names and case-insensitive collisions before writing", () => {
  const { file, device } = setup();
  const input = device("live.thisdevice");
  fs.writeFileSync(file("maxpat-package.json"), "{}");
  expect(() =>
    writePackage(
      discover(input, { assets: [file("maxpat-package.json")] }),
      file("out"),
    ),
  ).toThrow(/Reserved/);
  const d = discover(input);
  d.files.set("device.amxd", {
    source: file("other"),
    bytes: Buffer.from("other"),
  });
  expect(() => writePackage(d, file("out"))).toThrow(/collision/i);
});
it("rejects symlink roots, assets, references and outputs", () => {
  const { file, device } = setup();
  const input = device();
  fs.mkdirSync(file("scripts"));
  fs.writeFileSync(file("scripts/tempo.js"), "");
  fs.symlinkSync(file("scripts"), file("linked"), "junction");
  device("v8 linked/tempo.js");
  expect(() => discover(input)).toThrow(/Symlink/);
  expect(() => discover(input, { roots: [file("linked")] })).toThrow(/Symlink/);
  device("live.thisdevice");
  expect(() => discover(input, { assets: [file("linked/tempo.js")] })).toThrow(
    /Symlink/,
  );
  fs.symlinkSync(file("scripts"), file("out"), "junction");
  expect(() => writePackage(discover(input), file("out"), true)).toThrow(
    /symlink/i,
  );
});
it("rejects output ancestors of source files and a concurrent package lock", () => {
  const { file, dir, device } = setup();
  const input = device("live.thisdevice");
  const d = discover(input);
  expect(() => writePackage(d, dir, true)).toThrow(/source/);
  fs.mkdirSync(file(".out.maxpat-lock"));
  expect(() => writePackage(d, file("out"))).toThrow();
  expect(fs.existsSync(file(".out.maxpat-lock"))).toBe(true);
});
it("packages the real bundled Live tempo example and detects its removed script", () => {
  const { file, dir } = setup();
  const build = spawnSync(process.execPath, ["examples/live-tempo/build.mjs"], {
    cwd: resolve("."),
    encoding: "utf8",
  });
  expect(build.status, build.stderr).toBe(0);
  fs.cpSync("examples/generated/live-tempo", file("tempo"), {
    recursive: true,
  });
  const input = file("tempo/Live Tempo.amxd");
  const d = discover(input);
  expect(d.dependencies.find((d) => d.reference === "tempo.js")?.status).toBe(
    "resolved",
  );
  expect(
    d.dependencies.find((d) => d.reference === "LICENSE.tsln")?.status,
  ).toBe("resolved");
  writePackage(d, file("release"));
  expect(fs.existsSync(file("release/LICENSE.tsln"))).toBe(true);
  fs.unlinkSync(file("tempo/tempo.js"));
  expect(
    discover(input).dependencies.find((d) => d.reference === "tempo.js")
      ?.status,
  ).toBe("missing");
  expect(fs.readdirSync(dir)).toContain("release");
});
it("does not mistake message text for object declarations, and accepts numeric media filenames", () => {
  const { file, device } = setup();
  const input = device("v8 absent.js");
  const d = readAmxd(input);
  writeAmxd(input, {
    ...d,
    patch: PatchEditor.fromNormalized(d.patch)
      .updateBox("script", { maxclass: "message" })
      .toNormalized(),
  });
  expect(discover(input).dependencies).toEqual([]);
  fs.writeFileSync(file("808.wav"), "fixture");
  expect(
    discover(device("buffer~ sample 808.wav")).dependencies[0],
  ).toMatchObject({ reference: "808.wav", status: "resolved" });
});
it("rejects malformed dependency caches and reports invalid graphs with the existing exit code", () => {
  const { file, device } = setup();
  const input = device("live.thisdevice", { dependency_cache: [{}] });
  expect(cli("deps", input).status).toBe(2);
  device("live.thisdevice");
  const d = readAmxd(input);
  d.patch.lines[0].destId = "absent";
  writeAmxd(input, d, { skipValidation: true });
  expect(cli("package", input, "--output", file("out")).status).toBe(1);
  expect(fs.existsSync(file("out"))).toBe(false);
});
it.each([
  ["inspect", "--root", "."],
  ["check", "--asset", "x"],
  ["diff", "--dry-run"],
  ["create", "audio", "out.amxd", "--output", "out"],
  ["--version", "--root", "."],
])("rejects misplaced packaging flags: %s", (...args) =>
  expect(cli(...args).status).toBe(2),
);
