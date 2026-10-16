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
it("uses verified native dial heights and a dynamic noninteractive inset", () => {
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
  expect(dials(actual)[0].passthrough.appearance).toBe(3);
  expect(rect(dials(actual)[0])).toEqual([28, 48, 104, 63]);
  const panel = actual.patch.boxes.get("__maxpat_native_inset")!;
  const saved = native.patch.boxes.get("obj-4")!;
  expect(panel.passthrough.saved_attribute_attributes).toMatchObject(
    saved.passthrough.saved_attribute_attributes as object,
  );
  expect(panel.passthrough).toMatchObject({
    background: 1,
    ignoreclick: 1,
    border: 1,
    rounded: 4,
  });
  expect(panel.passthrough.bgcolor).toBeUndefined();
  expect(panel.passthrough.style).toBeUndefined();
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
      [...result.patch.boxes.values()].filter(
        (b) => b.maxclass === "live.comment",
      ),
    ).toHaveLength(0);
  },
);
it("preserves the sine graph without decorative captions", () => {
  const source = withSineGraph(createMaxForLiveDevice({ type: "instrument" }));
  const result = applyNativePresentation(source);
  expect(result.patch.lines).toEqual(source.patch.lines);
  for (const [id, box] of source.patch.boxes)
    expect(result.patch.boxes.get(id)).toEqual(box);
  expect(
    [...result.patch.boxes.values()].filter(
      (b) => b.maxclass === "live.comment",
    ),
  ).toHaveLength(0);
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
  ).toBeUndefined();
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
    ).toMatchObject(old.passthrough.saved_attribute_attributes as object);
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
  expect(rect(result.patch.boxes.get("p1")!)[0]).toBeGreaterThanOrEqual(376);
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
it("preserves explicit additions on styled devices", () => {
  const result = addLiveParameter(style(0), {
    ...parameter(0),
    presentation: { x: 12, y: 12, width: 60, height: 48 },
  });
  expect(rect(result.patch.boxes.get("p0")!)).toEqual([12, 12, 60, 48]);
  expect(
    result.patch.boxes.get("__maxpat_native_header")?.passthrough.presentation,
  ).toBeUndefined();
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
  expect(result.patch.boxes.has("__maxpat_native_header_2")).toBe(false);
  expect(encodeAmxd(applyNativePresentation(result))).toEqual(
    encodeAmxd(result),
  );
});
it("does not overwrite a generated label that a developer has connected", () => {
  const id = "__maxpat_native_header";
  const styled = userObject(style(0), id, [8, 8, 120, 18], "live.comment", {
    text: "AUDIO EFFECT",
    annotation: "max4live-ts-tools/native/v1/header",
  });
  const connected = {
    ...styled,
    patch: PatchEditor.fromNormalized(styled.patch)
      .connect(["input", 0], [id, 0])
      .toNormalized(),
  };
  const result = applyNativePresentation(connected);
  expect(result.patch.lines).toEqual(connected.patch.lines);
  expect(result.patch.boxes.get(id)).toEqual(connected.patch.boxes.get(id));
  expect(result.patch.boxes.has(id + "_2")).toBe(false);
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
  expect(styled.patch.boxes.size).toBe(saved.patch.boxes.size - 1);
  expect(styled.patch.boxes.has("__maxpat_native_header")).toBe(false);
  expect(styled.patch.boxes.has("__maxpat_native_separator")).toBe(false);
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

it("selects native appearances with actual heights and retains saved/custom appearances", () => {
  let device = createMaxForLiveDevice({ type: "audio" });
  for (const [i, appearance] of ["vertical", "large", "panel"].entries())
    device = addLiveParameter(device, {
      ...parameter(i),
      appearance: appearance as "vertical" | "large" | "panel",
    });
  const result = applyNativePresentation(device);
  expect(
    dials(result).map((b) => [b.passthrough.appearance, rect(b)[3]]),
  ).toEqual([
    [0, 48],
    [3, 63],
    [2, 80],
  ]);
  for (const box of dials(result))
    expect(rect(box)[1] + rect(box)[3]).toBeLessThanOrEqual(169);
  const custom = {
    ...device,
    patch: PatchEditor.fromNormalized(device.patch)
      .updateBox("p1", { passthrough: { appearance: 4 } })
      .toNormalized(),
  };
  expect(applyNativePresentation(custom).patch.boxes.get("p1")).toEqual(
    custom.patch.boxes.get("p1"),
  );
  const explicit = addLiveParameter(result, {
    ...parameter(4),
    appearance: "panel",
    presentation: { x: 380, y: 12, width: 90, height: 80 },
  });
  expect(rect(explicit.patch.boxes.get("p4")!)).toEqual([380, 12, 90, 80]);
  expect(explicit.patch.boxes.get("p4")!.passthrough.appearance).toBe(2);
});
it.each(["tiny", 3, null, ["large"], "__proto__"])(
  "rejects invalid appearance %j",
  (appearance) => {
    expect(() =>
      addLiveParameter(createMaxForLiveDevice({ type: "audio" }), {
        ...parameter(0),
        appearance,
      } as never),
    ).toThrow(/appearance/);
  },
);
it("removes only obsolete decorative labels, preserving repurposed and annotated user UI", () => {
  const saved = decodeAmxd(
    readFileSync(
      new URL(
        "./fixtures/stereo-gain-native-presentation-max-9.1.5.amxd",
        import.meta.url,
      ),
    ),
  );
  const base = applyNativePresentation(saved);
  expect(
    [...base.patch.boxes.values()].some(
      (b) => b.passthrough.text === "AUDIO EFFECT",
    ),
  ).toBe(false);
  for (const extra of [
    { text: "User display" },
    { text: "AUDIO EFFECT", varname: "functional_label" },
    { text: "AUDIO EFFECT", param_connect: "other::value" },
  ]) {
    const d = userObject(base, "legacy", [8, 8, 120, 18], "live.comment", {
      annotation: "max4live-ts-tools/native/v1/header",
      ...extra,
    });
    expect(applyNativePresentation(d).patch.boxes.get("legacy")).toEqual(
      d.patch.boxes.get("legacy"),
    );
  }
  const collision = userObject(base, "__maxpat_native_inset_2", [0, 0, 50, 12]);
  expect(
    applyNativePresentation(collision).patch.boxes.get(
      "__maxpat_native_inset_2",
    ),
  ).toEqual(collision.patch.boxes.get("__maxpat_native_inset_2"));
});
it("ignores background panels in bare parameter placement", () => {
  const base = createMaxForLiveDevice({ type: "audio" });
  const decorated = userObject(base, "background", [0, 0, 320, 160], "panel", {
    background: 1,
  });
  expect(
    rect(addLiveParameter(base, parameter(0)).patch.boxes.get("p0")!),
  ).toEqual(
    rect(addLiveParameter(decorated, parameter(0)).patch.boxes.get("p0")!),
  );
});

it("places a bare panel dial around a short obstacle below the vertical dial row", () => {
  const source = userObject(
    createMaxForLiveDevice({ type: "audio" }),
    "label",
    [20, 80, 60, 18],
  );
  const result = addLiveParameter(source, {
    ...parameter(0),
    appearance: "panel",
  });
  expect(rect(result.patch.boxes.get("p0")!)).toEqual([100, 20, 60, 80]);
});

it("checks retained inset bounds and actual native height even with explicit short rectangles", () => {
  for (const bounds of [
    [8, 150, 144, 112],
    [-8, 24, 144, 112],
  ]) {
    const original = style(1);
    const edited = {
      ...original,
      patch: PatchEditor.fromNormalized(original.patch)
        .updateBox("__maxpat_native_inset", {
          passthrough: { presentation_rect: bounds },
        })
        .toNormalized(),
    };
    expect(() => applyNativePresentation(edited)).toThrow(/169px/);
  }
  expect(() =>
    addLiveParameter(style(0), {
      ...parameter(0),
      appearance: "panel",
      presentation: { x: 20, y: 100, width: 80, height: 48 },
    }),
  ).toThrow(/169px/);
});

it("keeps the native-saved backdrop or rejects an extension across authored UI", () => {
  const initial = style(1);
  const dial = dials(initial)[0];
  const nativeSaved = {
    ...initial,
    patch: PatchEditor.fromNormalized(initial.patch)
      .updateBox(dial.id, { passthrough: { _maxpat_auto_presentation: null } })
      .toNormalized(),
  };
  const extended = addLiveParameter(nativeSaved, parameter(1));
  const panel = rect(extended.patch.boxes.get("__maxpat_native_inset")!);
  expect(panel[0]).toBeLessThanOrEqual(rect(dial)[0]);
  expect(panel[0] + panel[2]).toBeGreaterThanOrEqual(
    rect(dial)[0] + rect(dial)[2],
  );
  const withLabel = userObject(nativeSaved, "label", [140, 48, 80, 18]);
  const before = structuredClone(withLabel);
  expect(() => addLiveParameter(withLabel, parameter(1))).toThrow(
    /explicit parameter geometry/,
  );
  expect(withLabel).toEqual(before);
});

it.each([
  "stereo-gain-inset-max-9.1.5.amxd",
  "dial-appearances-inset-max-9.1.5.amxd",
])(
  "round-trips native inset save %s and preserves its controls on restyling",
  (name) => {
    const bytes = readFileSync(new URL(`./fixtures/${name}`, import.meta.url));
    const saved = decodeAmxd(bytes);
    expect(encodeAmxd(saved)).toEqual(new Uint8Array(bytes));
    const result = applyNativePresentation(saved);
    expect(dials(result)).toEqual(dials(saved));
    expect(result.patch.lines).toEqual(saved.patch.lines);
    const panel = result.patch.boxes.get("__maxpat_native_inset")!;
    expect(panel.passthrough).toMatchObject({
      rounded: 4,
      border: 1,
      background: 1,
      saved_attribute_attributes: {
        bgfillcolor: { expression: "themecolor.live_lcd_bg" },
        bordercolor: { expression: "themecolor.live_lcd_frame" },
      },
    });
    expect(encodeAmxd(applyNativePresentation(result))).toEqual(
      encodeAmxd(result),
    );
    if (name.startsWith("dial-"))
      expect(
        dials(saved).map((b) => [b.passthrough.appearance ?? 0, rect(b)[3]]),
      ).toEqual([
        [0, 48],
        [3, 63],
        [2, 80],
      ]);
  },
);
it("keeps native Stereo Gain processing and parameter semantics unchanged", () => {
  const original = decodeAmxd(
    readFileSync(
      new URL(
        "./fixtures/stereo-gain-native-presentation-max-9.1.5.amxd",
        import.meta.url,
      ),
    ),
  );
  const revised = decodeAmxd(
    readFileSync(
      new URL("./fixtures/stereo-gain-inset-max-9.1.5.amxd", import.meta.url),
    ),
  );
  expect(revised.patch.lines).toEqual(original.patch.lines);
  for (const [id, box] of original.patch.boxes) {
    if (id.startsWith("__maxpat_native_")) continue;
    const actual = revised.patch.boxes.get(id)!;
    if (id === "gain")
      expect(actual.passthrough.saved_attribute_attributes).toMatchObject(
        box.passthrough.saved_attribute_attributes as object,
      );
    else expect(actual).toEqual(box);
  }
  expect(revised.patch.patcherMeta.passthrough.parameters).toEqual(
    original.patch.patcherMeta.passthrough.parameters,
  );
});

it("reserves effective native height for undersized authored Panel rectangles", () => {
  const base = addLiveParameter(createMaxForLiveDevice({ type: "audio" }), {
    ...parameter(0),
    appearance: "panel",
    presentation: { x: 20, y: 0, width: 80, height: 1 },
  });
  expect(rect(base.patch.boxes.get("p0")!)).toEqual([20, 0, 80, 1]);
  const bare = addLiveParameter(base, parameter(1));
  expect(rect(bare.patch.boxes.get("p1")!)[0]).toBeGreaterThanOrEqual(120);
  const styled = applyNativePresentation(bare);
  expect(rect(styled.patch.boxes.get("p1")!)[0]).toBeGreaterThanOrEqual(116);
  expect(styled.patch.boxes.get("p0")).toEqual(base.patch.boxes.get("p0"));
});
