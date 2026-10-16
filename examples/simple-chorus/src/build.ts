import { mkdirSync } from "node:fs";
import { writeAmxd } from "max4live-ts-tools";
import { createSimpleChorus } from "./device.js";
mkdirSync("dist", { recursive: true });
writeAmxd("dist/Simple Chorus.amxd", createSimpleChorus());
console.log("Created dist/Simple Chorus.amxd");
