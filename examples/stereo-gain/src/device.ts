import {
  createMaxForLiveDevice,
  addLiveParameter,
  applyNativePresentation,
  PatchBuilder,
  PatchEditor,
} from "max4live-ts-tools";

export const INITIAL_GAIN = 0.5;
export const RAMP_MS = 10;

/** Offline graph construction; the generated device uses only built-in Max objects. */
export function createStereoGain() {
  const device = addLiveParameter(
    createMaxForLiveDevice({ type: "audio", name: "Stereo Gain" }),
    {
      id: "gain",
      name: "Gain",
      type: "float",
      min: 0,
      max: 1,
      default: INITIAL_GAIN,
      at: [330, 30],
    },
  );
  const dsp = new PatchBuilder()
    .object({
      id: "ramp-list",
      text: `pack 0. ${RAMP_MS}`,
      numinlets: 2,
      numoutlets: 1,
      at: [330, 210],
    })
    .object({
      id: "ramp",
      text: `line~ ${INITIAL_GAIN}`,
      numinlets: 2,
      numoutlets: 2,
      at: [330, 260],
    })
    .object({
      id: "left",
      text: "*~",
      numinlets: 2,
      numoutlets: 1,
      at: [30, 310],
    })
    .object({
      id: "right",
      text: "*~",
      numinlets: 2,
      numoutlets: 1,
      at: [160, 310],
    })
    .object({
      id: "ready",
      text: "live.thisdevice",
      numinlets: 1,
      numoutlets: 3,
      at: [450, 30],
    })
    .object({
      id: "initialise",
      text: "t b b b",
      numinlets: 1,
      numoutlets: 3,
      at: [450, 80],
    })
    .add("message", { id: "immediate", text: "0", at: [550, 130] })
    .add("message", { id: "smooth", text: String(RAMP_MS), at: [450, 160] })
    .add("comment", {
      id: "explanation",
      text: "Initialise from Live's restored Gain; ramp subsequent changes over 10 ms.",
      at: [30, 410],
      size: [500, 22],
    });

  let editor = PatchEditor.fromNormalized(device.patch)
    .disconnect(["input", 0], ["output", 0])
    .disconnect(["input", 1], ["output", 1])
    .updateBox("input", { patchingRect: [30, 30, 80, 22] })
    .updateBox("output", { patchingRect: [30, 370, 80, 22] })
    .withMetadata({
      rect: [0, 0, 660, 460],
      passthrough: { devicewidth: 100 },
    });
  for (const { id, ...spec } of dsp.toNormalized().boxes.values())
    editor = editor.addBox(spec, id);
  editor = editor
    .connect(["input", 0], ["left", 0])
    .connect(["input", 1], ["right", 0])
    .connect(["left", 0], ["output", 0])
    .connect(["right", 0], ["output", 1])
    .connect(["gain", 0], ["ramp-list", 0])
    .connect(["ramp-list", 0], ["ramp", 0])
    .connect(["ramp", 0], ["left", 1])
    .connect(["ramp", 0], ["right", 1])
    // trigger runs right to left: zero ramp time, bang the recalled dial, restore smoothing.
    .connect(["ready", 0], ["initialise", 0])
    .connect(["initialise", 2], ["immediate", 0])
    .connect(["immediate", 0], ["ramp-list", 1])
    .connect(["initialise", 1], ["gain", 0])
    .connect(["initialise", 0], ["smooth", 0])
    .connect(["smooth", 0], ["ramp-list", 1]);
  editor.validateOrThrow();
  return applyNativePresentation({ ...device, patch: editor.toNormalized() });
}
