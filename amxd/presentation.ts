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

// Private layout provenance, not a Max attribute. Max discards it on native save;
// subsequently its saved coordinates are treated as explicitly authored.
export const AUTO_RECT = "_maxpat_auto_presentation";
const OWNER = "max4live-ts-tools/native/v1/";
const HEIGHT = 169;
const TOP = 48;
const DIAL_HEIGHT = 63; // Max-saved Large appearance; its height is not freely resizable.
const round8 = (n: number) => Math.ceil(n / 8) * 8;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
type Role = "header" | "separator" | "status";
const classes: Record<Role, string> = {
  header: "live.comment",
  separator: "panel",
  status: "live.comment",
};
function elements(patch: NormalizedPatch): Map<Role, NormalizedBox> {
  const connected = new Set(patch.lines.flatMap((l) => [l.sourceId, l.destId]));
  const found = new Map<Role, NormalizedBox>();
  for (const box of patch.boxes.values()) {
    const role = (Object.keys(classes) as Role[]).find(
      (role) => box.passthrough.annotation === OWNER + role,
    );
    // Wiring a generated label turns it into user-authored functional UI.
    if (!role || box.maxclass !== classes[role] || connected.has(box.id))
      continue;
    if (found.has(role))
      throw new MaxpatEditError(
        "PRESENTATION_CONFLICT",
        `Duplicate owned ${role} objects`,
      );
    found.set(role, box);
  }
  return found;
}
export function hasNativePresentation(patch: NormalizedPatch): boolean {
  return elements(patch).size > 0;
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
function controlName(box: NormalizedBox): string {
  const attrs = box.passthrough.saved_attribute_attributes;
  const value = record(attrs) && record(attrs.valueof) ? attrs.valueof : {};
  return typeof value.parameter_shortname === "string"
    ? value.parameter_shortname
    : "";
}
function controlWidth(box: NormalizedBox): number {
  // Conservative allowance for native 10px labels and fallback Unicode glyphs.
  const width = Array.from(controlName(box)).reduce(
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
function insideHeight(box: NormalizedBox): void {
  const [x, y, w, h] = rect(box);
  if (x < 0 || y < 0 || w <= 0 || h <= 0 || y + h > HEIGHT)
    throw new MaxpatEditError(
      "PRESENTATION_BOUNDS",
      `Presentation object ${box.id} must fit within 169px; explicit coordinates were not changed`,
    );
}
function status(device: AmxdDevice): string {
  if (device.type === "instrument")
    return device.patch.lines.some((l) => l.destId === "output")
      ? "MIDI to audio"
      : "Silent scaffold";
  const direct = device.patch.lines.every(
    (l) => l.sourceId === "input" && l.destId === "output",
  );
  if (device.type === "midi")
    return direct ? "MIDI pass-through" : "MIDI processing";
  return direct ? "Stereo pass-through" : "Audio processing";
}
function label(
  text: string,
  bounds: Rect,
  role: Role,
  visible: boolean,
): BoxSpec {
  return {
    maxclass: classes[role],
    numinlets: 1,
    numoutlets: 0,
    patchingRect: bounds,
    passthrough: {
      annotation: OWNER + role,
      presentation: visible ? 1 : 0,
      presentation_rect: bounds,
      ignoreclick: 1,
      ...(role === "separator"
        ? {
            background: 1,
            mode: 0,
            border: 0,
            rounded: 0,
            shadow: 0,
            saved_attribute_attributes: {
              bgfillcolor: { expression: "themecolor.live_contrast_frame" },
            },
          }
        : { text, fontsize: 10, textjustification: 0 }),
    },
  };
}
function freeId(patch: NormalizedPatch, role: Role): string {
  const base = `__maxpat_native_${role}`;
  let id = base,
    i = 2;
  while (patch.boxes.has(id)) id = `${base}_${i++}`;
  return id;
}
/** Explicit native Live presentation; processing, registrations and binary metadata are preserved. */
export function applyNativePresentation(device: AmxdDevice): AmxdDevice {
  validateDeviceProject(device);
  let editor = PatchEditor.fromNormalized(device.patch);
  const patch = editor.toNormalized(),
    owned = elements(patch);
  const ownedIds = new Set([...owned.values()].map((box) => box.id));
  const registration = patch.patcherMeta.passthrough.parameters;
  const controls = [...patch.boxes.values()].filter(
    (box) =>
      box.maxclass === "live.dial" &&
      record(registration) &&
      Array.isArray(registration[box.id]),
  );
  const movable = new Set(controls.filter(automatic).map((box) => box.id));
  const existing = [...patch.boxes.values()].filter(
    (box) =>
      box.passthrough.presentation === 1 &&
      !ownedIds.has(box.id) &&
      !movable.has(box.id),
  );
  existing.forEach(insideHeight);
  const obstacles = existing
    .filter(
      (box) => !(box.maxclass === "panel" && box.passthrough.background === 1),
    )
    .map(rect);
  const occupied = obstacles.slice().sort((a, b) => a[0] - b[0]);
  let right = existing.reduce(
    (right, box) => Math.max(right, rect(box)[0] + rect(box)[2]),
    96,
  );
  for (const box of controls) {
    if (!movable.has(box.id)) continue;
    const width = controlWidth(box);
    let x = 16;
    for (const r of occupied)
      if (intersects([x - 8, TOP, width + 16, DIAL_HEIGHT], r))
        x = round8(r[0] + r[2] + 16);
    const bounds: Rect = [x, TOP, width, DIAL_HEIGHT];
    editor = editor.updateBox(box.id, {
      passthrough: {
        appearance: 3,
        showname: 1,
        shownumber: 1,
        presentation: 1,
        presentation_rect: bounds,
        [AUTO_RECT]: bounds,
      },
    });
    occupied.push(bounds);
    occupied.sort((a, b) => a[0] - b[0]);
    right = Math.max(right, x + width);
  }
  const caption = status(device);
  const empty = controls.length === 0 && obstacles.length === 0;
  const width = round8(
    Math.max(160, right + 16, empty ? caption.length * 6 + 32 : 0),
  );
  if (
    controls.length === 1 &&
    movable.has(controls[0].id) &&
    existing.length === 0
  ) {
    const box = editor.toNormalized().boxes.get(controls[0].id)!;
    const [, y, w, h] = rect(box);
    const bounds: Rect = [(width - w) / 2, y, w, h];
    editor = editor.updateBox(box.id, {
      passthrough: { presentation_rect: bounds, [AUTO_RECT]: bounds },
    });
  }
  const headerVisible = !obstacles.some((r) =>
    intersects(r, [8, 8, width - 16, 28]),
  );
  const specs: [Role, BoxSpec][] = [
    [
      "header",
      label(
        device.type === "audio"
          ? "AUDIO EFFECT"
          : device.type === "midi"
            ? "MIDI EFFECT"
            : "INSTRUMENT",
        [8, 8, width - 16, 18],
        "header",
        headerVisible,
      ),
    ],
    [
      "separator",
      label("", [8, 32, width - 16, 4], "separator", headerVisible),
    ],
  ];
  if (empty || owned.has("status"))
    specs.push([
      "status",
      label(caption, [16, 64, width - 32, 18], "status", empty),
    ]);
  for (const [role, spec] of specs) {
    const previous = owned.get(role);
    editor = previous
      ? editor.updateBox(previous.id, spec)
      : editor.addBox(spec, freeId(editor.toNormalized(), role));
  }
  editor = editor.withMetadata({
    passthrough: { openinpresentation: 1, devicewidth: width },
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
