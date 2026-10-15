import { mkdirSync } from "node:fs";
import { createMaxForLiveDevice, writeAmxd } from "../index.js";
import { withSineGraph } from "../amxd/sine-template.js";
mkdirSync("examples/generated", { recursive: true });
for (const type of ["audio", "midi"] as const) {
  writeAmxd(
    `examples/generated/${type}-passthrough.amxd`,
    createMaxForLiveDevice({ type, name: `${type} passthrough` }),
  );
}
const instrument = createMaxForLiveDevice({
  type: "instrument",
  name: "Sine Instrument",
});
writeAmxd("examples/generated/sine-instrument.amxd", withSineGraph(instrument));
console.log(
  "Created audio/MIDI passthrough devices and a velocity-controlled sine instrument.",
);
