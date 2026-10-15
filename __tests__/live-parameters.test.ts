import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  addLiveParameter,
  createMaxForLiveDevice,
  encodeAmxd,
  decodeAmxd,
  toPatchObject,
  PatchEditor,
  diffPatches,
} from "../index.js";
import type { LiveParameterOptions } from "../index.js";
const options: LiveParameterOptions = {
  id: "gain",
  name: "Gain",
  type: "float",
  min: 0,
  max: 1,
  default: 0.5,
};
const fixture = JSON.parse(
  readFileSync(
    new URL("./fixtures/live-parameters-max-9.1.5.maxpat", import.meta.url),
    "utf8",
  ),
);
it("matches actual Max-saved float dial metadata and root registrations", () => {
  let device = createMaxForLiveDevice({ type: "audio" });
  for (const { box } of fixture.patcher.boxes) {
    const param = box.saved_attribute_attributes.valueof;
    device = addLiveParameter(device, {
      id: box.id,
      name: param.parameter_longname,
      varname: box.varname,
      type: "float",
      min: param.parameter_mmin ?? 0,
      max: param.parameter_mmax ?? 127,
      default: param.parameter_initial[0],
      at: box.patching_rect.slice(0, 2),
      presentation: {
        x: box.presentation_rect[0],
        y: box.presentation_rect[1],
        width: box.presentation_rect[2],
        height: box.presentation_rect[3],
      },
    });
    expect(
      toPatchObject(device.patch).patcher.boxes.find((w) => w.box.id === box.id)
        ?.box,
    ).toEqual(box);
  }
  expect(device.patch.patcherMeta.passthrough.parameters).toEqual(
    fixture.patcher.parameters,
  );
});
it("owns revisions and binary chunks, preserves container order and survives editing and rewriting", () => {
  const base = decodeAmxd(
    encodeAmxd(createMaxForLiveDevice({ type: "audio" })),
  );
  base.container!.chunks = [
    { tag: "test", data: Uint8Array.of(1, 2) },
    ...base.container!.chunks,
    { tag: "test", data: Uint8Array.of(3) },
  ];
  const saved = structuredClone(base);
  const a = addLiveParameter(base, options);
  const b = addLiveParameter(a, {
    ...options,
    id: "mix",
    name: "Mix",
    max: 100,
    default: 25,
  });
  expect(base).toEqual(saved);
  expect(a.patch.boxes.has("mix")).toBe(false);
  expect(a.patch.boxes.get("gain")?.passthrough.presentation_rect).not.toEqual(
    b.patch.boxes.get("mix")?.passthrough.presentation_rect,
  );
  const edited = {
    ...b,
    patch: PatchEditor.fromNormalized(b.patch)
      .updateBox("input", { patchingRect: [40, 40, 80, 22] })
      .toNormalized(),
  };
  const round = decodeAmxd(encodeAmxd(edited));
  expect(diffPatches(edited.patch, round.patch).equal).toBe(true);
  expect(round.container!.chunks.map((c) => c.tag)).toEqual([
    "test",
    "meta",
    "ptch",
    "test",
  ]);
  expect(round.container!.chunks[0].data).toEqual(Uint8Array.of(1, 2));
  round.container!.chunks[0].data[0] = 99;
  expect(base.container!.chunks[0].data[0]).toBe(1);
});
it("keeps existing parameterbank slots and metadata intact", () => {
  const base = addLiveParameter(
    createMaxForLiveDevice({ type: "audio" }),
    options,
  );
  const params = base.patch.patcherMeta.passthrough.parameters as Record<
    string,
    unknown
  >;
  const banks = params.parameterbanks as Record<
    string,
    Record<string, unknown>
  >;
  banks["0"].name = "Existing";
  (banks["0"].parameters as string[])[0] = "gain";
  const next = addLiveParameter(base, { ...options, id: "mix", name: "Mix" });
  const result = next.patch.patcherMeta.passthrough.parameters as Record<
    string,
    unknown
  >;
  expect(result.parameterbanks).toEqual(banks);
  expect(result.gain).toEqual(["Gain", "Gain", 0]);
  expect(result.mix).toEqual(["Mix", "Mix", 0]);
});
it("rejects conflicting IDs, scripting and parameter names including nested dials", () => {
  const base = addLiveParameter(
    createMaxForLiveDevice({ type: "audio" }),
    options,
  );
  for (const next of [
    options,
    { ...options, id: "input", name: "Other" },
    { ...options, id: "other", name: "Gain" },
    { ...options, id: "other", name: "Other", shortName: "Gain" },
    { ...options, id: "other", name: "Other", varname: "gain" },
  ])
    expect(() => addLiveParameter(base, next)).toThrow();
  const editor = PatchEditor.fromNormalized(
    createMaxForLiveDevice({ type: "audio" }).patch,
  ).addBox(
    {
      maxclass: "newobj",
      passthrough: {
        text: "p nested",
        patcher: toPatchObject(base.patch).patcher,
      },
      numinlets: 0,
      numoutlets: 0,
      patchingRect: [0, 0, 80, 22],
    },
    "nested",
  );
  expect(() =>
    addLiveParameter({ type: "audio", patch: editor.toNormalized() }, options),
  ).toThrow(/unique/);
});
it("rejects malformed parameter dictionaries without mutating them", () => {
  for (const parameters of [
    [],
    null,
    { parameterbanks: [] },
    { parameterbanks: { 0: { index: 0, name: "bad", parameters: ["gain"] } } },
    { x: ["name"] },
    { inherited_shortname: "yes" },
  ]) {
    const base = createMaxForLiveDevice({ type: "audio" });
    base.patch.patcherMeta.passthrough.parameters = parameters;
    const before = structuredClone(base);
    expect(() => addLiveParameter(base, options)).toThrow(/dictionaries/);
    expect(base).toEqual(before);
  }
});
it("validates the intentionally narrow float API, ranges, identifiers and geometry", () => {
  for (const extra of [
    { type: "int" },
    { id: "parameterbanks" },
    { id: "a::b" },
    { name: " " },
    { varname: "x::y" },
    { min: 1, max: 1 },
    { min: 2, max: 1 },
    { default: 2 },
    { min: NaN },
    { max: Infinity },
    { max: 1e100 },
    { min: 1, max: 1 + Number.EPSILON },
    { presentation: { x: 0, y: 0, width: -1, height: 48 } },
  ])
    expect(() =>
      addLiveParameter(createMaxForLiveDevice({ type: "audio" }), {
        ...options,
        ...extra,
      } as LiveParameterOptions),
    ).toThrow();
});

it("expands default device width to keep five or more parameters visible", () => {
  let device = createMaxForLiveDevice({ type: "audio" });
  for (let i = 0; i < 10; i++)
    device = addLiveParameter(device, {
      ...options,
      id: `p${i}`,
      name: `Parameter ${i}`,
    });
  const width = device.patch.patcherMeta.passthrough.devicewidth as number;
  expect(width).toBe(800);
  for (const box of device.patch.boxes.values())
    if (box.maxclass === "live.dial") {
      const rect = box.passthrough.presentation_rect as number[];
      expect(rect[0] + rect[2]).toBeLessThanOrEqual(width);
      expect(rect[1]).toBe(20);
    }
});

it("round-trips the qualified Max-saved device byte-identically and preserves its dials during edits", () => {
  const bytes = readFileSync(
    new URL("./fixtures/live-parameters-max-9.1.5.amxd", import.meta.url),
  );
  const device = decodeAmxd(bytes);
  expect(Buffer.from(encodeAmxd(device))).toEqual(bytes);
  const changed = PatchEditor.fromNormalized(device.patch)
    .updateBox("input", { patchingRect: [40, 60, 80, 22] })
    .toNormalized();
  const round = decodeAmxd(encodeAmxd({ ...device, patch: changed }));
  for (const id of ["gain", "mix"])
    expect(round.patch.boxes.get(id)).toEqual(device.patch.boxes.get(id));
  expect(round.patch.patcherMeta.passthrough.parameters).toEqual(
    device.patch.patcherMeta.passthrough.parameters,
  );
});

it("places automatic controls around existing presentation objects without registrations", () => {
  const base = createMaxForLiveDevice({ type: "audio" });
  base.patch = PatchEditor.fromNormalized(base.patch)
    .addBox(
      {
        maxclass: "comment",
        numinlets: 1,
        numoutlets: 0,
        patchingRect: [20, 20, 240, 48],
        passthrough: {
          text: "Display",
          presentation: 1,
          presentation_rect: [20, 20, 240, 48],
        },
      },
      "display",
    )
    .addBox(
      {
        maxclass: "button",
        numinlets: 1,
        numoutlets: 1,
        patchingRect: [280, 20, 24, 24],
        passthrough: { presentation: 1 },
      },
      "button",
    )
    .toNormalized();
  expect(base.patch.patcherMeta.passthrough.parameters).toBeUndefined();
  const added = addLiveParameter(base, options);
  expect(added.patch.boxes.get("gain")?.passthrough.presentation_rect).toEqual([
    324, 20, 60, 48,
  ]);
  expect(added.patch.patcherMeta.passthrough.devicewidth).toBe(384);
  const explicit = addLiveParameter(base, {
    ...options,
    presentation: { x: 20, y: 20, width: 60, height: 48 },
  });
  expect(
    explicit.patch.boxes.get("gain")?.passthrough.presentation_rect,
  ).toEqual([20, 20, 60, 48]);
  expect(explicit.patch.patcherMeta.passthrough.devicewidth).toBe(
    base.patch.patcherMeta.passthrough.devicewidth,
  );
});
it("uses available gaps and ignores presentation objects in other rows", () => {
  const base = createMaxForLiveDevice({ type: "audio" });
  base.patch = PatchEditor.fromNormalized(base.patch)
    .addBox(
      {
        maxclass: "comment",
        numinlets: 1,
        numoutlets: 0,
        patchingRect: [0, 0, 100, 20],
        passthrough: { presentation: 1, presentation_rect: [0, 100, 100, 20] },
      },
      "lower-row",
    )
    .addBox(
      {
        maxclass: "comment",
        numinlets: 1,
        numoutlets: 0,
        patchingRect: [0, 0, 100, 20],
        passthrough: { presentation: 1, presentation_rect: [200, 20, 100, 20] },
      },
      "right",
    )
    .toNormalized();
  expect(
    addLiveParameter(base, options).patch.boxes.get("gain")?.passthrough
      .presentation_rect,
  ).toEqual([20, 20, 60, 48]);
});
it("returned devices and callers own separate mutable container buffers and patch metadata", () => {
  const base = decodeAmxd(
    encodeAmxd(createMaxForLiveDevice({ type: "audio" })),
  );
  base.container!.chunks = [
    ...base.container!.chunks,
    { tag: "blob", data: Uint8Array.of(1, 2, 3) },
  ];
  const added = addLiveParameter(base, options);
  added.container!.chunks[2].data[0] = 9;
  expect(base.container!.chunks[2].data).toEqual(Uint8Array.of(1, 2, 3));
  base.container!.chunks[2].data[1] = 8;
  expect(added.container!.chunks[2].data).toEqual(Uint8Array.of(9, 2, 3));
  (
    added.patch.patcherMeta.passthrough.parameters as Record<string, unknown>
  ).gain = ["Changed", "Changed", 0];
  expect(base.patch.patcherMeta.passthrough.parameters).toBeUndefined();
});
