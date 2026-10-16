import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  addLiveParameter,
  applyNativePresentation,
  createMaxForLiveDevice,
  decodeAmxd,
  encodeAmxd,
  PatchEditor,
  serializePatch,
} from "../index.js";
import { withSineGraph } from "../amxd/sine-template.js";
import type { AmxdDevice, AmxdDeviceType, NormalizedBox } from "../index.js";
const parameter = (i: number) => ({
  id: `p${i}`,
  name: `Parameter ${i}`,
  type: "float" as const,
  min: 0,
  max: 1,
  default: 0.5,
});
const native = decodeAmxd(
  readFileSync(
    new URL("./fixtures/native-presentation-max-9.1.5.amxd", import.meta.url),
  ),
);
const rect = (box: NormalizedBox) =>
  box.passthrough.presentation_rect as number[];
const dials = (d: AmxdDevice) =>
  [...d.patch.boxes.values()].filter((b) => b.maxclass === "live.dial");
function addParameters(d: AmxdDevice, count: number) {
  for (let i = 0; i < count; i++) d = addLiveParameter(d, parameter(i));
  return d;
}
const style = (count: number) =>
  applyNativePresentation(
    addParameters(createMaxForLiveDevice({ type: "audio" }), count),
  );
it("uses the saved Large dial height and native dynamic divider metadata", () => {
  expect(
    [...native.patch.boxes.values()]
      .filter((b) => b.maxclass === "live.dial")
      .map((b) => [b.passthrough.appearance ?? 0, rect(b)[3]]),
  ).toEqual([
    [3, 63],
    [2, 80],
    [0, 48],
  ]);
  const actual = style(1);
  const dial = dials(actual)[0];
  expect(dial.passthrough.appearance).toBe(3);
  expect(rect(dial)[3]).toBe(63);
  const divider = [...actual.patch.boxes.values()].find(
    (b) => b.maxclass === "panel",
  )!;
  const saved = native.patch.boxes.get("obj-6")!;
  expect(divider.passthrough.saved_attribute_attributes).toEqual(
    saved.passthrough.saved_attribute_attributes,
  );
  expect(divider.passthrough.background).toBe(saved.passthrough.background);
  expect(rect(divider)[3]).toBe(rect(saved)[3]);
  expect(divider.passthrough.ignoreclick).toBe(1);
  expect(divider.passthrough.bgcolor).toBeUndefined();
  expect(divider.passthrough.style).toBeUndefined();
});
it.each([0, 1, 2, 4, 8, 12])(
  "lays out %i controls deterministically within Live's height",
  (count) => {
    const device = style(count),
      width = device.patch.patcherMeta.passthrough.devicewidth as number;
    expect(serializePatch(device.patch)).toBe(
      serializePatch(style(count).patch),
    );
    const controls = dials(device);
    expect(controls).toHaveLength(count);
    for (let i = 0; i < controls.length; i++) {
      const [x, y, w, h] = rect(controls[i]);
      expect(y).toBe(48);
      expect(y + h).toBeLessThanOrEqual(169);
      expect(x + w + 16).toBeLessThanOrEqual(width);
      if (i)
        expect(x).toBeGreaterThanOrEqual(
          rect(controls[i - 1])[0] + rect(controls[i - 1])[2] + 16,
        );
    }
    expect(encodeAmxd(applyNativePresentation(device))).toEqual(
      encodeAmxd(device),
    );
  },
);
it.each(["audio", "midi", "instrument"] as AmxdDeviceType[])(
  "preserves the %s scaffold, metadata and original API",
  (type) => {
    const source = createMaxForLiveDevice({ type, name: "Device" }),
      before = structuredClone(source);
    const result = applyNativePresentation(source);
    expect(source).toEqual(before);
    expect(source.patch.boxes.size).toBe(2);
    expect(source.patch.patcherMeta.passthrough.devicewidth).toBe(320);
    expect(result.patch.lines).toEqual(source.patch.lines);
    for (const [id, box] of source.patch.boxes)
      expect(result.patch.boxes.get(id)).toEqual(box);
    expect(result.patch.patcherMeta.passthrough.project).toEqual(
      source.patch.patcherMeta.passthrough.project,
    );
    expect(result.patch.patcherMeta.passthrough.title).toBe("Device");
    expect(
      [...result.patch.boxes.values()].some(
        (b) =>
          b.passthrough.text ===
          (type === "instrument"
            ? "Silent scaffold"
            : type === "midi"
              ? "MIDI pass-through"
              : "Stereo pass-through"),
      ),
    ).toBe(true);
  },
);
it("preserves the sine graph and describes its actual function", () => {
  const source = withSineGraph(createMaxForLiveDevice({ type: "instrument" }));
  const result = applyNativePresentation(source);
  expect(result.patch.lines).toEqual(source.patch.lines);
  for (const [id, box] of source.patch.boxes)
    expect(result.patch.boxes.get(id)).toEqual(box);
  expect(
    [...result.patch.boxes.values()].some(
      (b) => b.passthrough.text === "MIDI to audio",
    ),
  ).toBe(true);
});
it("supports either incremental order without decorations consuming layout slots", () => {
  const base = createMaxForLiveDevice({ type: "audio" });
  const a = applyNativePresentation(addParameters(base, 4));
  const b = addParameters(applyNativePresentation(base), 4);
  expect(dials(a)).toEqual(dials(b));
  expect(b.patch.patcherMeta.passthrough.devicewidth).toBe(
    a.patch.patcherMeta.passthrough.devicewidth,
  );
  expect(
    b.patch.boxes.get("__maxpat_native_status")?.passthrough.presentation,
  ).toBe(0);
  expect(encodeAmxd(applyNativePresentation(b))).toEqual(encodeAmxd(b));
});
it("makes room for long native short names without changing registration or values", () => {
  let source = createMaxForLiveDevice({ type: "audio" });
  source = addLiveParameter(source, {
    ...parameter(0),
    name: "An exceptionally long Gain parameter name including Unicode 音量",
  });
  source = addLiveParameter(source, {
    ...parameter(1),
    name: "Long automation name",
    shortName: "Mix",
  });
  const result = applyNativePresentation(source),
    controls = dials(result);
  expect(rect(controls[0])[2]).toBeGreaterThan(400);
  expect(rect(controls[1])[2]).toBe(80);
  expect(rect(controls[1])[0]).toBeGreaterThan(
    rect(controls[0])[0] + rect(controls[0])[2],
  );
  expect(result.patch.patcherMeta.passthrough.parameters).toEqual(
    source.patch.patcherMeta.passthrough.parameters,
  );
  for (const old of dials(source))
    expect(
      result.patch.boxes.get(old.id)?.passthrough.saved_attribute_attributes,
    ).toEqual(old.passthrough.saved_attribute_attributes);
});
function userObject(
  d: AmxdDevice,
  id: string,
  bounds: number[],
  maxclass = "live.comment",
  extra = {},
) {
  return {
    ...d,
    patch: PatchEditor.fromNormalized(d.patch)
      .addBox(
        {
          maxclass,
          numinlets: 1,
          numoutlets: 0,
          patchingRect: [0, 0, 80, 18],
          passthrough: {
            text: "User display",
            presentation: 1,
            presentation_rect: bounds,
            ...extra,
          },
        },
        id,
      )
      .toNormalized(),
  };
}
it("respects user UI, explicit geometry, manual moves and decorative background layers", () => {
  let source = userObject(
    createMaxForLiveDevice({ type: "audio" }),
    "label",
    [16, 48, 200, 30],
  );
  source = userObject(source, "background", [0, 0, 400, 160], "panel", {
    background: 1,
  });
  source = addLiveParameter(source, {
    ...parameter(0),
    presentation: { x: 300, y: 112, width: 60, height: 48 },
  });
  source = addLiveParameter(source, parameter(1));
  const result = applyNativePresentation(source);
  for (const id of ["label", "background", "p0"])
    expect(result.patch.boxes.get(id)).toEqual(source.patch.boxes.get(id));
  expect(rect(result.patch.boxes.get("p1")!)).toEqual([232, 48, 104, 63]);
  const moved = {
    ...result,
    patch: PatchEditor.fromNormalized(result.patch)
      .updateBox("p1", {
        passthrough: { presentation_rect: [450, 48, 128, 63] },
      })
      .toNormalized(),
  };
  expect(rect(applyNativePresentation(moved).patch.boxes.get("p1")!)[0]).toBe(
    450,
  );
});
it("preserves explicit additions on styled devices and avoids their header region", () => {
  const result = addLiveParameter(style(0), {
    ...parameter(0),
    presentation: { x: 12, y: 12, width: 60, height: 48 },
  });
  expect(rect(result.patch.boxes.get("p0")!)).toEqual([12, 12, 60, 48]);
  expect(
    result.patch.boxes.get("__maxpat_native_header")?.passthrough.presentation,
  ).toBe(0);
  const before = structuredClone(result);
  expect(() =>
    addLiveParameter(result, {
      ...parameter(1),
      presentation: { x: 0, y: 160, width: 60, height: 48 },
    }),
  ).toThrow(/169px/);
  expect(result).toEqual(before);
});
it("never treats names resembling generated IDs as ownership", () => {
  const source = userObject(
    createMaxForLiveDevice({ type: "audio" }),
    "__maxpat_native_header",
    [8, 8, 120, 18],
  );
  const result = applyNativePresentation(source);
  expect(result.patch.boxes.get("__maxpat_native_header")).toEqual(
    source.patch.boxes.get("__maxpat_native_header"),
  );
  expect(result.patch.boxes.has("__maxpat_native_header_2")).toBe(true);
  expect(encodeAmxd(applyNativePresentation(result))).toEqual(
    encodeAmxd(result),
  );
});
it("does not overwrite a generated label that a developer has connected", () => {
  const styled = style(0),
    id = "__maxpat_native_header";
  const connected = {
    ...styled,
    patch: PatchEditor.fromNormalized(styled.patch)
      .connect(["input", 0], [id, 0])
      .toNormalized(),
  };
  const result = applyNativePresentation(connected);
  expect(result.patch.lines).toEqual(connected.patch.lines);
  expect(result.patch.boxes.get(id)).toEqual(connected.patch.boxes.get(id));
  expect(result.patch.boxes.has(id + "_2")).toBe(true);
});
it("owns immutable binary revisions and preserves unknown chunk data and ordering", () => {
  const source = decodeAmxd(
    encodeAmxd(addParameters(createMaxForLiveDevice({ type: "audio" }), 2)),
  );
  source.container!.chunks = [
    { tag: "test", data: Uint8Array.of(8) },
    ...source.container!.chunks,
    { tag: "test", data: Uint8Array.of(9) },
  ];
  const before = structuredClone(source),
    result = applyNativePresentation(source);
  expect(source).toEqual(before);
  expect(result.container).toEqual(source.container);
  expect(result.patch.lines).toEqual(source.patch.lines);
  expect(
    decodeAmxd(encodeAmxd(result)).container!.chunks.map((c) => c.tag),
  ).toEqual(["test", "meta", "ptch", "test"]);
  result.container!.chunks[0].data[0] = 0;
  expect(source.container!.chunks[0].data[0]).toBe(8);
  expect(
    encodeAmxd(decodeAmxd(encodeAmxd(applyNativePresentation(source)))),
  ).toEqual(encodeAmxd(applyNativePresentation(source)));
});

it("restyles a genuine Max-saved Stereo Gain without duplicating or moving native UI", () => {
  const bytes = readFileSync(
    new URL(
      "./fixtures/stereo-gain-native-presentation-max-9.1.5.amxd",
      import.meta.url,
    ),
  );
  const saved = decodeAmxd(bytes);
  expect(encodeAmxd(saved)).toEqual(new Uint8Array(bytes));
  const styled = applyNativePresentation(saved);
  expect(styled.patch.boxes.size).toBe(saved.patch.boxes.size);
  expect(styled.patch.lines).toEqual(saved.patch.lines);
  expect(styled.patch.boxes.get("gain")).toEqual(saved.patch.boxes.get("gain"));
  expect(dials(styled)).toHaveLength(1);
  expect(rect(dials(styled)[0])).toEqual([40, 48, 80, 63]);
  expect(
    dials(styled)[0].passthrough._maxpat_auto_presentation,
  ).toBeUndefined();
  expect(encodeAmxd(applyNativePresentation(styled))).toEqual(
    encodeAmxd(styled),
  );
  const extended = addLiveParameter(styled, parameter(1));
  expect(extended.patch.boxes.get("gain")).toEqual(
    saved.patch.boxes.get("gain"),
  );
  expect(rect(extended.patch.boxes.get("p1")!)[0]).toBeGreaterThanOrEqual(136);
  expect(
    Object.keys(
      extended.patch.patcherMeta.passthrough.parameters as object,
    ).filter((k) => k !== "parameterbanks" && k !== "inherited_shortname"),
  ).toEqual(["gain", "p1"]);
});

it("reserves room for long wide-glyph native labels", () => {
  const d = applyNativePresentation(
    addLiveParameter(createMaxForLiveDevice({ type: "audio" }), {
      ...parameter(0),
      name: "WWWWMMMMWWWWMMMMWWWW",
    }),
  );
  expect(rect(dials(d)[0])[2]).toBeGreaterThanOrEqual(216);
});
