import { PatchEditor } from "../editor/patch-editor.js";
import type { AmxdDevice } from "./codec.js";
/** Shared CLI/example template: velocity envelope, quiet stereo sine, no external dependencies. */
export function withSineGraph(instrument: AmxdDevice): AmxdDevice {
  let editor = PatchEditor.fromNormalized(instrument.patch);
  for (const [id, text, inputs, outputs, x, y] of [
    ["notes", "notein", 1, 3, 160, 30],
    ["frequency", "mtof", 1, 1, 160, 70],
    ["oscillator", "cycle~", 2, 1, 160, 110],
    ["velocity", "/ 127.", 2, 1, 300, 70],
    ["ramp", "pack 0. 10", 2, 1, 300, 110],
    ["envelope", "line~", 2, 2, 300, 150],
    ["multiply", "*~", 2, 1, 160, 190],
    ["level", "*~ 0.1", 2, 1, 160, 230],
  ] as const)
    editor = editor.addBox(
      {
        maxclass: "newobj",
        numinlets: inputs,
        numoutlets: outputs,
        patchingRect: [x, y, 80, 22],
        passthrough: { text },
      },
      id,
    );
  for (const [from, outlet, to, inlet] of [
    ["notes", 0, "frequency", 0],
    ["frequency", 0, "oscillator", 0],
    ["notes", 1, "velocity", 0],
    ["velocity", 0, "ramp", 0],
    ["ramp", 0, "envelope", 0],
    ["envelope", 0, "multiply", 1],
    ["oscillator", 0, "multiply", 0],
    ["multiply", 0, "level", 0],
    ["level", 0, "output", 0],
    ["level", 0, "output", 1],
  ] as const)
    editor = editor.connect([from, outlet], [to, inlet]);
  return { ...instrument, patch: editor.toNormalized() };
}
