import { mkdirSync } from "node:fs";
import {
  createMaxForLiveDevice,
  addLiveParameter,
  writeAmxd,
} from "../index.js";
mkdirSync("examples/generated", { recursive: true });
let device = createMaxForLiveDevice({
  type: "audio",
  name: "Parameter Example",
});
device = addLiveParameter(device, {
  id: "gain",
  name: "Gain",
  type: "float",
  min: 0,
  max: 1,
  default: 0.5,
  presentation: { x: 20, y: 20, width: 60, height: 48 },
});
device = addLiveParameter(device, {
  id: "mix",
  name: "Mix",
  type: "float",
  min: 0,
  max: 100,
  default: 25,
  presentation: { x: 100, y: 20, width: 60, height: 48 },
});
writeAmxd("examples/generated/Parameters.amxd", device);
console.log(
  "Created two registered float dials; connect their outlets to your processing graph.",
);
