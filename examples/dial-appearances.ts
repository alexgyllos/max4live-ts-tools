import { mkdirSync } from "node:fs";
import {
  addLiveParameter,
  applyNativePresentation,
  createMaxForLiveDevice,
  writeAmxd,
} from "../index.js";
import type { LiveDialAppearance } from "../index.js";

/** Presentation comparison only: audio passes through; the three dials are UI examples. */
export function createDialAppearances() {
  let device = createMaxForLiveDevice({
    type: "audio",
    name: "Native Dial Appearances",
  });
  for (const appearance of [
    "vertical",
    "large",
    "panel",
  ] as LiveDialAppearance[]) {
    device = addLiveParameter(device, {
      id: appearance,
      name: appearance[0].toUpperCase() + appearance.slice(1),
      type: "float",
      min: 0,
      max: 1,
      default: 0.5,
      appearance,
    });
  }
  return applyNativePresentation(device);
}
mkdirSync("examples/generated", { recursive: true });
writeAmxd(
  "examples/generated/Native Dial Appearances.amxd",
  createDialAppearances(),
);
