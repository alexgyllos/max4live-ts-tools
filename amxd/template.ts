import { PatchBuilder } from "../editor/patch-builder.js";
import type { AmxdDevice, AmxdDeviceType } from "./codec.js";
import { AmxdError } from "./codec.js";
/** I/O port counts and project type tags follow Live's saved Max device templates. */
export function createMaxForLiveDevice(options: {
  type: AmxdDeviceType;
  name?: string;
}): AmxdDevice {
  const tags = { audio: 1633771873, midi: 1835887981, instrument: 1768515945 };
  if (!Object.hasOwn(tags, options.type))
    throw new AmxdError(
      "UNSUPPORTED_AMXD",
      "Expected audio, midi or instrument device type",
    );
  if (
    options.name !== undefined &&
    (typeof options.name !== "string" || !options.name.trim())
  )
    throw new TypeError("Device name must be nonempty text");
  let builder = new PatchBuilder({
    rect: [0, 0, 600, 360],
    metadata: {
      fileversion: 1,
      classnamespace: "box",
      openinpresentation: 1,
      devicewidth: 320,
      title: options.name ?? "Untitled Device",
      project: {
        version: 1,
        amxdtype: tags[options.type],
        readonly: 0,
        devpathtype: 0,
        devpath: ".",
        autoorganize: 1,
        hideprojectwindow: 1,
        autolocalize: 0,
        contents: { patchers: {} },
        layout: {},
        searchpath: {},
      },
    },
  });
  builder = builder
    .object({
      id: "input",
      text: options.type === "audio" ? "plugin~" : "midiin",
      at: [20, 30],
      numinlets: options.type === "audio" ? 2 : 1,
      numoutlets: options.type === "audio" ? 2 : 1,
    })
    .object({
      id: "output",
      text: options.type === "midi" ? "midiout" : "plugout~",
      at: [20, 240],
      numinlets: options.type === "midi" ? 1 : 2,
      numoutlets: options.type === "midi" ? 0 : 2,
    });
  if (options.type !== "instrument")
    builder = builder.connect(["input", 0], ["output", 0]);
  if (options.type === "audio")
    builder = builder.connect(["input", 1], ["output", 1]);
  return { type: options.type, patch: builder.toNormalized() };
}
