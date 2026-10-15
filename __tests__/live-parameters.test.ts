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
