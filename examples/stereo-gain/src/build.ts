import { mkdirSync } from "node:fs";
import { writeAmxd } from "max4live-ts-tools";
import { createStereoGain } from "./device.js";

mkdirSync("dist", { recursive: true });
writeAmxd("dist/Stereo Gain.amxd", createStereoGain());
console.log("Created dist/Stereo Gain.amxd");
