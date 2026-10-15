import { PatchEditor } from "../editor/patch-editor.js";
import { walkPatch } from "../nested.js";
import { assertJson } from "../validate/json.js";
import { MaxpatEditError } from "../errors.js";
import { validateDeviceProject } from "./validate.js";
import type { AmxdDevice } from "./codec.js";
import type { BoxSpec, NormalizedPatch, Rect } from "../types.js";

export type LiveParameterOptions = {
  id: string;
  name: string;
  shortName?: string;
  varname?: string;
  type: "float";
  min: number;
  max: number;
  default: number;
  at?: readonly [number, number];
  presentation?: { x: number; y: number; width: number; height: number };
};
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const fail = (code: string, message: string): never => {
  throw new MaxpatEditError(code, message);
};
const metadataError = (): never =>
  fail(
    "INVALID_PARAMETER_METADATA",
    "Expected valid parameters and parameterbanks dictionaries; existing metadata was not changed",
  );
function parameters(value: unknown): Record<string, unknown> {
  if (value === undefined)
    return {
      parameterbanks: {
        "0": {
          index: 0,
          name: "",
          parameters: Array(8).fill("-"),
          buttons: Array(8).fill("-"),
        },
      },
      inherited_shortname: 1,
    };
  if (!record(value)) return metadataError();
  for (const [key, entry] of Object.entries(value)) {
    if (key === "parameterbanks") {
      if (!record(entry)) return metadataError();
      for (const bank of Object.values(entry)) {
        if (
          !record(bank) ||
          !Number.isSafeInteger(bank.index) ||
          (bank.index as number) < 0 ||
          typeof bank.name !== "string"
        )
          return metadataError();
        for (const field of ["parameters", "buttons"]) {
          if (field === "buttons" && bank[field] === undefined) continue;
          const slots = bank[field];
          if (
            !Array.isArray(slots) ||
            slots.length !== 8 ||
            slots.some((slot) => typeof slot !== "string")
          )
            return metadataError();
        }
      }
    } else if (key === "inherited_shortname") {
      if (entry !== 0 && entry !== 1) return metadataError();
    } else if (
      !Array.isArray(entry) ||
      entry.length !== 3 ||
      typeof entry[0] !== "string" ||
      typeof entry[1] !== "string" ||
      !Number.isSafeInteger(entry[2])
    )
      return metadataError();
  }
  return value;
}
type ResolvedParameter = LiveParameterOptions & {
  shortName: string;
  varname: string;
};
function validateOptions(options: LiveParameterOptions): ResolvedParameter {
  assertJson(options);
  if (!options || typeof options !== "object" || Array.isArray(options))
    return fail("INVALID_PARAMETER", "Expected live.dial parameter options");
  const { id, name, min, max, default: initial } = options;
  const shortName = options.shortName ?? name,
    varname = options.varname ?? id;
  if (
    options.type !== "float" ||
    typeof id !== "string" ||
    !/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(id) ||
    ["parameterbanks", "inherited_shortname"].includes(id)
  )
    return fail(
      "INVALID_PARAMETER",
      "Expected a float parameter with an identifier containing letters, digits, underscores or hyphens",
    );
  if (
    [name, shortName, varname].some(
      (value) =>
        typeof value !== "string" || !value.trim() || value.includes("::"),
    )
  )
    return fail(
      "INVALID_PARAMETER",
      "Parameter names must be nonempty and must not contain the scope separator ::",
    );
  if (
    [min, max, initial].some(
      (value) =>
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        !Number.isFinite(Math.fround(value)),
    ) ||
    min >= max ||
    Math.fround(min) >= Math.fround(max) ||
    initial < min ||
    initial > max
  )
    return fail(
      "INVALID_PARAMETER",
      "Expected a finite float range min < max and a default within that range",
    );
  if (
    options.at !== undefined &&
    (!Array.isArray(options.at) ||
      options.at.length !== 2 ||
      options.at.some(
        (value) => typeof value !== "number" || !Number.isFinite(value),
      ))
  )
    return fail(
      "INVALID_PARAMETER",
      "Expected finite patching position [x, y]",
    );
  if (options.presentation !== undefined)
    presentationRect(options.presentation);
  return { ...options, shortName, varname };
}
function assertNoConflicts(
  patch: NormalizedPatch,
  registration: Record<string, unknown>,
  options: ResolvedParameter,
): void {
  const { id, name, shortName, varname } = options;
  if (patch.boxes.has(id) || Object.hasOwn(registration, id))
    return fail(
      "PARAMETER_CONFLICT",
      `Parameter/object ID ${id} already exists`,
    );
  for (const box of patch.boxes.values())
    if (box.passthrough.varname === varname)
      return fail(
        "PARAMETER_CONFLICT",
        `Scripting name ${varname} already exists`,
      );
  for (const entry of Object.values(registration))
    if (Array.isArray(entry) && (entry[0] === name || entry[1] === shortName))
      return fail(
        "PARAMETER_CONFLICT",
        "Parameter long and short names must be unique",
      );
  for (const { patch: scope } of walkPatch(patch))
    for (const box of scope.boxes.values()) {
      const saved = box.passthrough.saved_attribute_attributes;
      if (
        record(saved) &&
        record(saved.valueof) &&
        (saved.valueof.parameter_longname === name ||
          saved.valueof.parameter_shortname === shortName)
      )
        return fail(
          "PARAMETER_CONFLICT",
          "Parameter long and short names must be unique across embedded patchers",
        );
    }
}
function presentationRect(
  value: NonNullable<LiveParameterOptions["presentation"]>,
): Rect {
  if (
    !value ||
    typeof value !== "object" ||
    [value.x, value.y, value.width, value.height].some(
      (number) => typeof number !== "number" || !Number.isFinite(number),
    ) ||
    value.width <= 0 ||
    value.height <= 0
  )
    return fail(
      "INVALID_PARAMETER",
      "Expected finite presentation coordinates and positive dimensions",
    );
  return [value.x, value.y, value.width, value.height];
}
function automaticPresentation(patch: NormalizedPatch): Rect {
  const occupied = [...patch.boxes.values()]
    .filter((box) => box.passthrough.presentation === 1)
    .map((box) => {
      const rect = box.passthrough.presentation_rect;
      return Array.isArray(rect) &&
        rect.length === 4 &&
        rect.every(
          (value) => typeof value === "number" && Number.isFinite(value),
        ) &&
        rect[2] > 0 &&
        rect[3] > 0
        ? (rect as unknown as Rect)
        : box.patchingRect;
    })
    .sort((a, b) => a[0] - b[0]);
  let x = 20;
  for (const [left, top, width, height] of occupied) {
    if (top < 68 && top + height > 20 && left < x + 80 && left + width + 20 > x)
      x = left + width + 20;
  }
  return [x, 20, 60, 48];
}
function parameterBox(
  options: ResolvedParameter,
  rect: Rect,
  count: number,
): BoxSpec {
  const { name, shortName, varname, min, max, default: initial } = options;
  return {
    maxclass: "live.dial",
    numinlets: 1,
    numoutlets: 2,
    patchingRect: [
      options.at?.[0] ?? 240 + count * 80,
      options.at?.[1] ?? 50,
      41,
      48,
    ],
    passthrough: {
      outlettype: ["", "float"],
      parameter_enable: 1,
      varname,
      presentation: 1,
      presentation_rect: rect,
      // Native Max 9.1.5 float attributes; defaults omitted in the same way Max saves them.
      saved_attribute_attributes: {
        valueof: {
          parameter_longname: name,
          parameter_shortname: shortName,
          parameter_type: 0,
          parameter_unitstyle: 1,
          parameter_modmode: 0,
          parameter_initial_enable: 1,
          parameter_initial: [initial],
          ...(min === 0 ? {} : { parameter_mmin: min }),
          ...(max === 127 ? {} : { parameter_mmax: max }),
        },
      },
    },
  };
}
/** Adds an automated/stored float live.dial to the root patcher, owning the returned device and container. */
export function addLiveParameter(
  device: AmxdDevice,
  input: LiveParameterOptions,
): AmxdDevice {
  const options = validateOptions(input);
  let editor = PatchEditor.fromNormalized(device.patch);
  validateDeviceProject(device);
  const meta = device.patch.patcherMeta.passthrough;
  const registration = parameters(meta.parameters);
  assertNoConflicts(device.patch, registration, options);
  const rect =
    options.presentation === undefined
      ? automaticPresentation(device.patch)
      : presentationRect(options.presentation);
  const layout =
    options.presentation === undefined
      ? {
          devicewidth: Math.max(
            typeof meta.devicewidth === "number" ? meta.devicewidth : 320,
            rect[0] + rect[2],
          ),
        }
      : {};
  editor = editor
    .addBox(
      parameterBox(
        options,
        rect,
        Object.values(registration).filter(Array.isArray).length,
      ),
      options.id,
    )
    .withMetadata({
      passthrough: {
        ...meta,
        ...layout,
        parameters: {
          ...registration,
          [options.id]: [options.name, options.shortName, 0],
        },
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
