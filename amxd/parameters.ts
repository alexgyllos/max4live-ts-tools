import { PatchEditor } from "../editor/patch-editor.js";
import { walkPatch } from "../nested.js";
import { assertJson } from "../validate/json.js";
import { MaxpatEditError } from "../errors.js";
import { validateDeviceProject } from "./validate.js";
import type { AmxdDevice } from "./codec.js";
import type { Rect } from "../types.js";

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
/** Adds an automated/stored float live.dial to the root patcher, owning the returned device and container. */
export function addLiveParameter(
  device: AmxdDevice,
  options: LiveParameterOptions,
): AmxdDevice {
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
  let editor = PatchEditor.fromNormalized(device.patch);
  validateDeviceProject(device);
  const owned = structuredClone(device);
  const meta = owned.patch.patcherMeta.passthrough;
  const registration = parameters(meta.parameters);
  if (editor.findById(id) || Object.hasOwn(registration, id))
    return fail(
      "PARAMETER_CONFLICT",
      `Parameter/object ID ${id} already exists`,
    );
  for (const box of owned.patch.boxes.values())
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
  for (const { patch } of walkPatch(owned.patch))
    for (const box of patch.boxes.values()) {
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
  const count = Object.values(registration).filter(Array.isArray).length;
  const presentation = options.presentation ?? {
    x: 20 + (count % 8) * 80,
    y: 20 + Math.floor(count / 8) * 70,
    width: 60,
    height: 48,
  };
  if (
    !presentation ||
    typeof presentation !== "object" ||
    [
      presentation.x,
      presentation.y,
      presentation.width,
      presentation.height,
    ].some((value) => typeof value !== "number" || !Number.isFinite(value)) ||
    presentation.width <= 0 ||
    presentation.height <= 0
  )
    return fail(
      "INVALID_PARAMETER",
      "Expected finite presentation coordinates and positive dimensions",
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
  const rect: Rect = [
    presentation.x,
    presentation.y,
    presentation.width,
    presentation.height,
  ];
  editor = editor.addBox(
    {
      maxclass: "live.dial",
      numinlets: 1,
      numoutlets: 2,
      patchingRect: [options.at?.[0] ?? 240, options.at?.[1] ?? 50, 41, 48],
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
    },
    id,
  );
  editor = editor.withMetadata({
    passthrough: {
      ...meta,
      parameters: { ...registration, [id]: [name, shortName, 0] },
    },
  });
  editor.validateOrThrow();
  return { ...owned, patch: editor.toNormalized() };
}
