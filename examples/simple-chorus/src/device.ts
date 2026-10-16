import {
  createMaxForLiveDevice,
  addLiveParameter,
  PatchEditor,
} from "max4live-ts-tools";

export const BASE_DELAY_MS = 15;
export const MAX_DEPTH_MS = 8;
export const RAMP_MS = 20;
export const CONTROLS = [
  {
    id: "rate",
    name: "Rate",
    min: 0.1,
    max: 5,
    default: 0.8,
    unit: 3,
  },
  {
    id: "depth",
    name: "Depth",
    min: 0,
    max: MAX_DEPTH_MS,
    default: 3,
    unit: 2,
  },
  {
    id: "mix",
    name: "Mix",
    min: 0,
    max: 100,
    default: 35,
    unit: 5,
  },
] as const;

/** A two-channel modulated delay, with no feedback, external assets or runtime scripts. */
export function createSimpleChorus() {
  let device = createMaxForLiveDevice({ type: "audio", name: "Simple Chorus" });
  for (const [i, { unit: _unit, ...parameter }] of CONTROLS.entries())
    device = addLiveParameter(device, {
      ...parameter,
      type: "float",
      presentation: { x: 24 + i * 72, y: 110, width: 41, height: 48 },
    });
  let editor = PatchEditor.fromNormalized(device.patch)
    .disconnect(["input", 0], ["output", 0])
    .disconnect(["input", 1], ["output", 1])
    .withMetadata({
      rect: [0, 0, 1050, 880],
      passthrough: { openinpresentation: 1, devicewidth: 232 },
    });
  const object = (
    id: string,
    text: string,
    ins: number,
    outs: number,
    x: number,
    y: number,
  ) => {
    editor = editor.addBox(
      {
        maxclass: "newobj",
        numinlets: ins,
        numoutlets: outs,
        patchingRect: [x, y, 130, 22],
        passthrough: { text },
      },
      id,
    );
  };
  const connect = (from: string, outlet: number, to: string, inlet: number) => {
    editor = editor.connect([from, outlet], [to, inlet]);
  };
  object("ready", "live.thisdevice", 1, 3, 600, 20);
  object("restore", "t b b b b b", 1, 5, 600, 60);
  for (const [id, text, x] of [
    ["immediate", "0", 780],
    ["smooth", String(RAMP_MS), 900],
  ] as const)
    editor = editor.addBox(
      {
        maxclass: "message",
        numinlets: 2,
        numoutlets: 1,
        patchingRect: [x, 100, 60, 22],
        passthrough: { text },
      },
      id,
    );
  connect("ready", 0, "restore", 0);
  connect("restore", 4, "immediate", 0);
  connect("restore", 0, "smooth", 0);
  for (const [i, control] of CONTROLS.entries()) {
    const old = editor.toNormalized().boxes.get(control.id)!;
    const saved = old.passthrough.saved_attribute_attributes as {
      valueof: Record<string, unknown>;
    };
    editor = editor.updateBox(control.id, {
      passthrough: {
        saved_attribute_attributes: {
          ...saved,
          valueof: { ...saved.valueof, parameter_unitstyle: control.unit },
        },
      },
    });
    const value =
      control.id === "mix" ? control.default / 100 : control.default;
    object(
      `${control.id}-pack`,
      `pack 0. ${RAMP_MS}`,
      2,
      1,
      220 + i * 180,
      180,
    );
    object(`${control.id}-signal`, `line~ ${value}`, 2, 2, 220 + i * 180, 230);
    if (control.id === "mix") {
      object("mix-normalise", "/ 100.", 2, 1, 580, 140);
      connect(control.id, 0, "mix-normalise", 0);
      connect("mix-normalise", 0, `${control.id}-pack`, 0);
    } else connect(control.id, 0, `${control.id}-pack`, 0);
    connect(`${control.id}-pack`, 0, `${control.id}-signal`, 0);
    connect("immediate", 0, `${control.id}-pack`, 1);
    connect("smooth", 0, `${control.id}-pack`, 1);
    // Trigger runs right-to-left: zero ramp, bang recalled controls, restore smoothing.
    connect("restore", 3 - i, control.id, 0);
  }
  object("phase", "phasor~ 0.8", 2, 1, 220, 290);
  object("right-phase", "+~ 0.25", 2, 1, 400, 330);
  object("dry-level", "!-~ 1.", 2, 1, 700, 290);
  connect("rate-signal", 0, "phase", 0);
  connect("phase", 0, "right-phase", 0);
  connect("mix-signal", 0, "dry-level", 0);
  // Two seconds of actual modulation history, independent of the audio sample rate.
  object("display-dsp", "dspstate~", 1, 4, 700, 720);
  object("display-duration", "* 2.", 2, 1, 700, 760);
  object("display-samples", "prepend samples", 1, 1, 700, 800);
  connect("ready", 0, "display-dsp", 0);
  connect("display-dsp", 1, "display-duration", 0);
  connect("display-duration", 0, "display-samples", 0);
  editor = editor.addBox(
    {
      maxclass: "panel",
      numinlets: 1,
      numoutlets: 0,
      patchingRect: [12, 720, 208, 84],
      passthrough: {
        presentation: 1,
        presentation_rect: [8, 8, 216, 88],
        background: 1,
        ignoreclick: 1,
        border: 0,
        rounded: 4,
        mode: 0,
        saved_attribute_attributes: {
          bgfillcolor: { expression: "themecolor.live_lcd_bg" },
        },
      },
    },
    "display-background",
  );
  for (const [channel, name] of ["left", "right"].entries()) {
    const x = 30 + channel * 450;
    object(`${name}-lfo`, "cos~", 1, 1, x + 150, 380);
    object(`${name}-depth`, "*~", 2, 1, x + 150, 420);
    object(`${name}-time`, `+~ ${BASE_DELAY_MS}`, 2, 1, x + 150, 460);
    object(`${name}-buffer`, "tapin~ 50", 1, 1, x, 420);
    object(`${name}-delay`, `tapout~ ${BASE_DELAY_MS}`, 1, 1, x, 510);
    object(`${name}-wet`, "*~", 2, 1, x, 560);
    object(`${name}-dry`, "*~", 2, 1, x + 150, 560);
    object(`${name}-sum`, "+~", 2, 1, x, 620);
    connect(channel === 0 ? "phase" : "right-phase", 0, `${name}-lfo`, 0);
    connect(`${name}-lfo`, 0, `${name}-depth`, 0);
    connect("depth-signal", 0, `${name}-depth`, 1);
    connect(`${name}-depth`, 0, `${name}-time`, 0);
    connect("input", channel, `${name}-buffer`, 0);
    // tapin~ attaches the buffer; the other cord supplies continuous delay time.
    connect(`${name}-buffer`, 0, `${name}-delay`, 0);
    connect(`${name}-time`, 0, `${name}-delay`, 0);
    connect(`${name}-delay`, 0, `${name}-wet`, 0);
    connect("mix-signal", 0, `${name}-wet`, 1);
    connect("input", channel, `${name}-dry`, 0);
    connect("dry-level", 0, `${name}-dry`, 1);
    connect(`${name}-wet`, 0, `${name}-sum`, 0);
    connect(`${name}-dry`, 0, `${name}-sum`, 1);
    connect(`${name}-sum`, 0, "output", channel);
    editor = editor.addBox(
      {
        maxclass: "live.scope~",
        numinlets: 2,
        numoutlets: 1,
        patchingRect: [20 + channel * 250, 750, 200, 70],
        passthrough: {
          presentation: 1,
          presentation_rect: [16, 16, 200, 72],
          ignoreclick: 1,
          active: 1,
          mode: 0,
          samples: 96000,
          interval: 33,
          range: [-10, 10],
          grid: 0,
          smooth: 2,
          line_width: 1.5,
          decay_time: 0,
          bgcolor: [0, 0, 0, 0],
          activebgcolor: [0, 0, 0, 0],
          activelinecolor: channel ? [0.19, 0.76, 0.82, 1] : [1, 0.69, 0.35, 1],
        },
      },
      `${name}-display`,
    );
    connect(`${name}-depth`, 0, `${name}-display`, 0);
    connect("display-samples", 0, `${name}-display`, 0);
  }
  editor.validateOrThrow();
  return { ...device, patch: editor.toNormalized() };
}
