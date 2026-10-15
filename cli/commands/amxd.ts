import { readFile } from "../../io/reader.js";
import { writeFile } from "../../io/writer.js";
import { readAmxd, writeAmxd } from "../../amxd/files.js";
import type { AmxdDeviceType } from "../../amxd/codec.js";
import { validateDeviceBuild } from "../../amxd/validate.js";
import { requireFiles } from "../args.js";
import { output, type CliIO } from "../output.js";
import { inspect } from "./inspect.js";
export function amxd(
  files: string[],
  deviceType: string | undefined,
  json: boolean,
  io: CliIO,
): number {
  const [operation, ...paths] = files;
  if (!["build", "extract", "inspect"].includes(operation))
    throw new Error("Expected amxd build, extract or inspect");
  requireFiles(operation, paths, operation === "inspect" ? 1 : 2);
  if (operation !== "build" && deviceType !== undefined)
    throw new Error("--type is only supported by amxd build");
  if (operation === "inspect") return inspect(paths[0], json, io, true);
  let type: AmxdDeviceType;
  if (operation === "build") {
    if (!deviceType || !["audio", "midi", "instrument"].includes(deviceType))
      throw new Error("amxd build requires --type audio, midi or instrument");
    type = deviceType as AmxdDeviceType;
    const device = { type, patch: readFile(paths[0], { validateGraph: true }) };
    validateDeviceBuild(device);
    writeAmxd(paths[1], device);
  } else {
    const device = readAmxd(paths[0]);
    type = device.type;
    writeFile(paths[1], device.patch, { skipValidation: true });
  }
  output(
    io,
    json,
    { command: "amxd", operation, ok: true, type, output: paths[1] },
    `${operation} ${type} device: ${paths[1]}\n`,
  );
  return 0;
}
