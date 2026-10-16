import { PatchEditor } from "../editor/patch-editor.js";
import { MaxpatEditError } from "../errors.js";
import { validateDeviceProject } from "./validate.js";
import type { AmxdDevice } from "./codec.js";
import type {
  BoxSpec,
  NormalizedBox,
  NormalizedPatch,
  Rect,
} from "../types.js";

// Max drops this private hint on native save; saved geometry then remains authored.
export const AUTO_RECT = "_maxpat_auto_presentation";
export type LiveDialAppearance = "vertical" | "panel" | "large";
export const DIALS = {
  vertical: { value: 0, height: 48 },
  panel: { value: 2, height: 80 },
  large: { value: 3, height: 63 },
} as const;
const OWNER = "max4live-ts-tools/native/v2/inset";
const LEGACY = "max4live-ts-tools/native/v1/";
const HEIGHT = 169;
const round8 = (n: number) => Math.ceil(n / 8) * 8;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
function decorations(patch: NormalizedPatch): {
  obsolete: string[];
  inset?: NormalizedBox;
} {
  const connected = new Set(patch.lines.flatMap((l) => [l.sourceId, l.destId]));
  const registration = patch.patcherMeta.passthrough.parameters;
  const obsolete: string[] = [];
  let inset: NormalizedBox | undefined;
  for (const box of patch.boxes.values()) {
    const a = box.passthrough;
    // Wiring, scripting names and parameter bindings transfer ownership to the author.
    if (
      connected.has(box.id) ||
      a.varname ||
      a.parameter_enable ||
      a.param_connect ||
      (record(registration) && Object.hasOwn(registration, box.id))
    )
      continue;
    if (a.annotation === OWNER && box.maxclass === "panel") {
      if (inset)
        throw new MaxpatEditError(
          "PRESENTATION_CONFLICT",
          "Duplicate owned inset panels",
        );
      inset = box;
    }
    const legacyLabel =
      box.maxclass === "live.comment" &&
      ((a.annotation === LEGACY + "header" &&
        ["AUDIO EFFECT", "MIDI EFFECT", "INSTRUMENT"].includes(
          String(a.text),
        )) ||
        (a.annotation === LEGACY + "status" &&
          [
            "Stereo pass-through",
            "Audio processing",
            "MIDI pass-through",
            "MIDI processing",
            "MIDI to audio",
            "Silent scaffold",
          ].includes(String(a.text))));
    const saved = a.saved_attribute_attributes;
    const legacySeparator =
      a.annotation === LEGACY + "separator" &&
      box.maxclass === "panel" &&
      record(saved) &&
      record(saved.bgfillcolor) &&
      saved.bgfillcolor.expression === "themecolor.live_contrast_frame";
    if (legacyLabel || legacySeparator) obsolete.push(box.id);
  }
  return { obsolete, inset };
}
export function hasNativePresentation(patch: NormalizedPatch): boolean {
  const owned = decorations(patch);
  return !!owned.inset || owned.obsolete.length > 0;
}
function rect(box: NormalizedBox): Rect {
  const value = box.passthrough.presentation_rect;
  return Array.isArray(value) &&
    value.length === 4 &&
    value.every((n) => typeof n === "number" && Number.isFinite(n))
    ? (value as unknown as Rect)
    : box.patchingRect;
}
function automatic(box: NormalizedBox): boolean {
  const saved = box.passthrough[AUTO_RECT];
  return (
    box.passthrough.presentation === 1 &&
    Array.isArray(saved) &&
    saved.length === 4 &&
    saved.every((n, i) => n === rect(box)[i])
  );
}
function dialStyle(box: NormalizedBox) {
  const value = box.passthrough.appearance ?? 3;
  return Object.values(DIALS).find((style) => style.value === value);
}
function controlWidth(box: NormalizedBox): number {
  const attrs = box.passthrough.saved_attribute_attributes;
  const value = record(attrs) && record(attrs.valueof) ? attrs.valueof : {};
  const name =
    typeof value.parameter_shortname === "string"
      ? value.parameter_shortname
      : "";
  const width = Array.from(name).reduce(
    (w, c) => w + (/^[MW]$/.test(c) ? 10 : /^[\x00-\x7f]$/.test(c) ? 8 : 12),
    16,
  );
  return Math.max(80, round8(width));
}
function intersects(a: Rect, b: Rect): boolean {
  return (
    a[0] < b[0] + b[2] &&
    a[0] + a[2] > b[0] &&
    a[1] < b[1] + b[3] &&
    a[1] + a[3] > b[1]
  );
}
// Native dial heights are fixed even when an authored rectangle requests less.
export function nativePresentationRect(box: NormalizedBox): Rect {
  const [x, y, w, h] = rect(box);
  const height =
    box.maxclass === "live.dial"
      ? (Object.values(DIALS).find(
          (style) => style.value === (box.passthrough.appearance ?? 0),
        )?.height ?? h)
      : h;
  return [x, y, w, Math.max(h, height)];
}
function insideHeight(box: NormalizedBox): void {
  const [x, y, w, h] = nativePresentationRect(box);
  if (x < 0 || y < 0 || w <= 0 || rect(box)[3] <= 0 || y + h > HEIGHT)
    throw new MaxpatEditError(
      "PRESENTATION_BOUNDS",
      `Presentation object ${box.id} must fit within 169px; explicit coordinates were not changed`,
    );
}
const colour = (name: string) => ({ expression: `themecolor.${name}` });
function insetPanel(bounds: Rect): BoxSpec {
  return {
    maxclass: "panel",
    numinlets: 1,
    numoutlets: 0,
    patchingRect: bounds,
    passthrough: {
      annotation: OWNER,
      presentation: 1,
      presentation_rect: bounds,
      ignoreclick: 1,
      background: 1,
      mode: 0,
      border: 1,
      rounded: 4,
      shadow: 0,
      saved_attribute_attributes: {
        bgfillcolor: colour("live_lcd_bg"),
        bordercolor: colour("live_lcd_frame"),
      },
    },
  };
}
function freeId(patch: NormalizedPatch): string {
  const base = "__maxpat_native_inset";
  let id = base,
    i = 2;
  while (patch.boxes.has(id)) id = `${base}_${i++}`;
  return id;
}
/** Explicit native control grouping; processing, registrations and authored UI are preserved. */
export function applyNativePresentation(device: AmxdDevice): AmxdDevice {
  validateDeviceProject(device);
  let editor = PatchEditor.fromNormalized(device.patch);
  const patch = editor.toNormalized(),
    owned = decorations(patch);
  for (const id of owned.obsolete) editor = editor.removeBox(id);
  const registration = patch.patcherMeta.passthrough.parameters;
  const controls = [...patch.boxes.values()].filter(
    (box) =>
      box.maxclass === "live.dial" &&
      record(registration) &&
      Array.isArray(registration[box.id]) &&
      automatic(box) &&
      dialStyle(box),
  );
  const movable = new Set(controls.map((box) => box.id));
  const excluded = new Set([
    ...owned.obsolete,
    ...(owned.inset ? [owned.inset.id] : []),
  ]);
  const existing = [...patch.boxes.values()].filter(
    (box) =>
      box.passthrough.presentation === 1 &&
      !excluded.has(box.id) &&
      !movable.has(box.id),
  );
  existing.forEach(insideHeight);
  if (owned.inset) insideHeight(owned.inset);
  const obstacles = existing
    .filter(
      (box) => !(box.maxclass === "panel" && box.passthrough.background === 1),
    )
    .map(nativePresentationRect)
    .sort((a, b) => a[0] - b[0]);
  const groupWidth = controls.reduce(
    (w, box) => w + controlWidth(box) + 16,
    16,
  );
  const groupHeight = controls.length
    ? controls.reduce(
        (height, box) => Math.max(height, dialStyle(box)!.height),
        0,
      ) + 32
    : 112;
  let group: Rect = [
    8,
    Math.floor((160 - groupHeight) / 2),
    Math.max(144, groupWidth),
    groupHeight,
  ];
  for (const obstacle of obstacles) {
    if (intersects(group, obstacle))
      group = [
        round8(obstacle[0] + obstacle[2] + 16),
        group[1],
        group[2],
        group[3],
      ];
  }
  // Only toolkit-laid-out controls receive the inset palette; authored colours stay untouched.
  let x = group[0] + 16;
  if (controls.length === 1)
    x = group[0] + (group[2] - controlWidth(controls[0])) / 2;
  for (const box of controls) {
    const style = dialStyle(box)!;
    const bounds: Rect = [
      x,
      Math.floor((160 - style.height) / 2),
      controlWidth(box),
      style.height,
    ];
    const saved = box.passthrough.saved_attribute_attributes;
    editor = editor.updateBox(box.id, {
      passthrough: {
        appearance: style.value,
        showname: 1,
        shownumber: 1,
        presentation: 1,
        presentation_rect: bounds,
        [AUTO_RECT]: bounds,
        saved_attribute_attributes: {
          textcolor: colour("live_lcd_control_fg"),
          activeneedlecolor: colour("live_lcd_control_fg"),
          activefgdialcolor: colour("live_lcd_control_fg_zombie"),
          ...(style.value === 2
            ? {
                panelcolor: colour("live_lcd_bg"),
                bordercolor: colour("live_lcd_frame"),
              }
            : {}),
          ...(record(saved) ? saved : {}),
        },
      },
    });
    x += bounds[2] + 16;
  }
  // A native save drops AUTO_RECT: keep its existing inset and authored control geometry.
  let bounds = controls.length || !owned.inset ? group : rect(owned.inset);
  if (
    controls.length &&
    owned.inset &&
    existing.some((box) => {
      const b = nativePresentationRect(box),
        old = rect(owned.inset!);
      return (
        b[0] >= old[0] &&
        b[1] >= old[1] &&
        b[0] + b[2] <= old[0] + old[2] &&
        b[1] + b[3] <= old[1] + old[3]
      );
    })
  ) {
    const old = rect(owned.inset);
    const left = Math.min(old[0], group[0]),
      top = Math.min(old[1], group[1]);
    const union: Rect = [
      left,
      top,
      Math.max(old[0] + old[2], group[0] + group[2]) - left,
      Math.max(old[1] + old[3], group[1] + group[3]) - top,
    ];
    if (
      obstacles.every(
        (r) =>
          !intersects(r, union) ||
          (r[0] >= old[0] &&
            r[1] >= old[1] &&
            r[0] + r[2] <= old[0] + old[2] &&
            r[1] + r[3] <= old[1] + old[3]),
      )
    )
      bounds = union;
    else
      throw new MaxpatEditError(
        "PRESENTATION_CONFLICT",
        "Cannot extend the existing inset across authored UI; supply explicit parameter geometry",
      );
  }
  const spec = insetPanel(bounds);
  editor = owned.inset
    ? editor.updateBox(owned.inset.id, spec)
    : editor.addBox(spec, freeId(editor.toNormalized()));
  const right = existing.reduce(
    (right, box) => Math.max(right, rect(box)[0] + rect(box)[2]),
    bounds[0] + bounds[2],
  );
  editor = editor.withMetadata({
    passthrough: {
      openinpresentation: 1,
      devicewidth: round8(Math.max(160, right + 8)),
    },
  });
  editor.validateOrThrow();
  return {
    type: device.type,
    patch: editor.toNormalized(),
    ...(device.container === undefined
      ? {}
      : { container: structuredClone(device.container) }),
  };
}
