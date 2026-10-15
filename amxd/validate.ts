import { walkPatch } from "../nested.js";
import type { NormalizedBox } from "../types.js";
import { AmxdError, type AmxdDevice } from "./codec.js";

export const DEVICE_TYPE_TAGS = {
  audio: 1633771873,
  midi: 1835887981,
  instrument: 1768515945,
};
const invalid = (message: string): never => {
  throw new AmxdError("MALFORMED_AMXD", message);
};

/** Keep low-level encoding available for containers without project metadata. */
export function validateDeviceProject(
  device: AmxdDevice,
  required = false,
): void {
  const project = device.patch.patcherMeta.passthrough.project;
  if (project === undefined && !required) return;
  if (
    !project ||
    typeof project !== "object" ||
    Array.isArray(project) ||
    ["searchpath", "layout", "contents"].some((key) => {
      const value = (project as Record<string, unknown>)[key];
      return !value || typeof value !== "object" || Array.isArray(value);
    })
  )
    invalid(
      "Device project metadata requires searchpath, layout and contents dictionaries; start with createMaxForLiveDevice() or export a device patch from Max",
    );
  const tag = (project as Record<string, unknown>).amxdtype;
  if ((required || tag !== undefined) && tag !== DEVICE_TYPE_TAGS[device.type])
    invalid(
      `Device project.amxdtype must match the selected ${device.type} type`,
    );
}

function objectName(box: NormalizedBox): string {
  if (box.maxclass !== "newobj") return box.maxclass;
  const text = box.passthrough.text;
  return typeof text === "string" ? text.trim().split(/\s+/)[0] : "";
}

/** Conservative CLI preflight; referenced abstractions are never loaded. */
export function validateDeviceBuild(device: AmxdDevice): void {
  validateDeviceProject(device, true);
  const objects = new Set(
    [...walkPatch(device.patch)].flatMap(({ patch }) =>
      [...patch.boxes.values()].map(objectName),
    ),
  );
  const hasAny = (names: string[]) => names.some((name) => objects.has(name));
  const midiInputs = [
    "midiin",
    "notein",
    "ctlin",
    "pgmin",
    "bendin",
    "touchin",
    "polytouchin",
    "sysexin",
  ];
  const midiOutputs = [
    "midiout",
    "noteout",
    "ctlout",
    "pgmout",
    "bendout",
    "touchout",
    "polytouchout",
  ];
  if (
    device.type === "audio" &&
    (!objects.has("plugin~") || !objects.has("plugout~"))
  )
    invalid(
      "Audio device build requires plugin~ input and plugout~ output objects",
    );
  if (device.type === "midi" && (!hasAny(midiInputs) || !hasAny(midiOutputs)))
    invalid(
      "MIDI device build requires MIDI input and output objects (for example midiin and midiout)",
    );
  // Generative instruments may produce audio without receiving MIDI.
  if (device.type === "instrument" && !objects.has("plugout~"))
    invalid("Instrument device build requires a plugout~ output object");
}
