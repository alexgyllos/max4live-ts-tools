import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import {
  PatchBuilder,
  parsePatchObject,
  validateGraph,
  decodeAmxd,
  encodeAmxd,
  type CommonObjectName,
} from "../index.js";

const read = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url));
const native = JSON.parse(
  read("typed-native-objects-max-9.1.5.maxpat").toString(),
);
const prior = JSON.parse(read("common-objects-max-9.1.5.maxpat").toString());
const box = (name: string) =>
  native.patcher.boxes.find(
    (entry: { box: { varname: string } }) => entry.box.varname === name,
  )!.box;

it("agrees with independently saved common-object port defaults", () => {
  expect(native.patcher.appversion).toMatchObject({
    major: 9,
    minor: 1,
    revision: 5,
  });
  expect(validateGraph(parsePatchObject(native)).ok).toBe(true);
  for (const { box: original } of prior.patcher.boxes) {
    if (original.varname === "print") continue;
    const actual = box(original.varname);
    const built = new PatchBuilder()
      .add(original.varname as CommonObjectName)
      .toRaw().patcher.boxes[0].box;
    for (const key of ["maxclass", "numinlets", "numoutlets"] as const) {
      expect(actual[key], `${original.varname}.${key}`).toEqual(original[key]);
      expect(actual[key]).toEqual(built[key]);
    }
  }
});

it("records native presentation canonicalisation and dynamic colour metadata", () => {
  expect(native.patcher).toMatchObject({
    openinpresentation: 1,
    devicewidth: 320,
  });
  // Max canonicalises dial heights, rather than retaining the requested 88 pixels.
  for (const [name, appearance, rect] of [
    ["dial_vertical", 0, [16, 48, 60, 48]],
    ["dial_panel", 2, [96, 48, 72, 80]],
    ["dial_large", 3, [192, 48, 80, 63]],
  ] as const) {
    const actual = box(name);
    expect(actual.appearance ?? 0).toBe(appearance);
    expect(actual.presentation_rect).toEqual(rect);
    expect(actual).toMatchObject({
      maxclass: "live.dial",
      parameter_enable: 1,
      numinlets: 1,
      numoutlets: 2,
    });
    expect(actual.saved_attribute_attributes.valueof).toMatchObject({
      parameter_type: 0,
      parameter_unitstyle: 0,
    });
  }
  expect(box("header")).toMatchObject({
    maxclass: "live.comment",
    text: "NATIVE FIXTURE",
    fontsize: 10,
    presentation_rect: [8, 8, 288, 18],
  });
  expect(box("header").textjustification ?? 0).toBe(0);
  expect(box("separator")).toMatchObject({
    maxclass: "panel",
    background: 1,
    rounded: 0,
    presentation_rect: [8, 32, 288, 4],
    saved_attribute_attributes: {
      bgfillcolor: { expression: "themecolor.live_contrast_frame" },
    },
  });
});

it("preserves Max-registered device parameters, project metadata and original bytes", () => {
  const bytes = read("typed-native-device-max-9.1.5.amxd");
  const device = decodeAmxd(bytes, { validateGraph: true });
  expect(encodeAmxd(device)).toEqual(Uint8Array.from(bytes));
  expect(device.patch.patcherMeta.appversion).toMatchObject({
    major: 9,
    minor: 1,
    revision: 5,
  });
  const metadata = device.patch.patcherMeta.passthrough;
  expect(metadata.project).toMatchObject({
    devpath: ".",
    amxdtype: 1633771873,
    searchpath: {},
    contents: { patchers: {} },
  });
  const parameters = metadata.parameters as Record<string, unknown>;
  const dials = [...device.patch.boxes.values()].filter(
    (b) =>
      typeof b.passthrough.varname === "string" &&
      b.passthrough.varname.startsWith("dial_"),
  );
  expect(dials.map((b) => b.passthrough.varname)).toEqual([
    "dial_vertical",
    "dial_panel",
    "dial_large",
  ]);
  for (const b of device.patch.boxes.values()) {
    const name = b.passthrough.varname;
    if (typeof name === "string" && name.startsWith("dial_"))
      expect(parameters[b.id]).toEqual([name, name, 0]);
    expect(b.passthrough.text ?? "").not.toMatch(/^v8 /);
  }
  expect(JSON.stringify(metadata)).not.toMatch(/\/Users\/|[A-Z]:\\/);
});

it("preserves native work when the host builder runs again", () => {
  const directory = mkdtempSync(join(tmpdir(), "native host "));
  const destination = join(directory, "Host.amxd");
  const script = fileURLToPath(
    new URL("../tools/native-fixtures/build-host.mjs", import.meta.url),
  );
  const run = () =>
    spawnSync(process.execPath, [script, destination], { encoding: "utf8" });
  try {
    expect(run().status).toBe(0);
    expect(decodeAmxd(readFileSync(destination)).type).toBe("audio");
    const nativeWork = Buffer.from("Native output must never be replaced");
    writeFileSync(destination, nativeWork);
    expect(run().status).toBe(0);
    expect(readFileSync(destination)).toEqual(nativeWork);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
