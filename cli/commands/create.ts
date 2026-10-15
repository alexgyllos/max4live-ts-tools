import { basename, extname } from "node:path";
import { createMaxForLiveDevice } from "../../amxd/template.js";
import { withSineGraph } from "../../amxd/sine-template.js";
import { writeAmxd } from "../../amxd/files.js";
import type { AmxdDeviceType } from "../../amxd/codec.js";
import { validateDeviceBuild } from "../../amxd/validate.js";
import { MaxpatValidationError } from "../../errors.js";
import { validateGraph } from "../../validate/graph.js";
import { output, type CliIO } from "../output.js";
import type { CliArgs } from "../args.js";
export function create(files: string[], options: CliArgs, io: CliIO): number {
  const [type, file] = files;
  if (files.length !== 2 || !["audio", "midi", "instrument"].includes(type))
    throw new Error(
      "create requires audio, midi or instrument and an output .amxd filename",
    );
  if (extname(file).toLowerCase() !== ".amxd")
    throw new Error("create output must have an .amxd extension");
  if (
    options.template !== undefined &&
    (options.template !== "sine" || type !== "instrument")
  )
    throw new Error("--template sine is supported only for instrument devices");
  const name = options.name ?? basename(file, extname(file));
  if (!name.trim()) throw new Error("Device name must not be empty");
  let device = createMaxForLiveDevice({ type: type as AmxdDeviceType, name });
  if (options.template === "sine") device = withSineGraph(device);
  validateDeviceBuild(device);
  const validation = validateGraph(device.patch);
  if (!validation.ok)
    throw new MaxpatValidationError(
      "Generated device has an invalid graph",
      validation.diagnostics,
    );
  writeAmxd(file, device, { overwrite: options.force });
  output(
    io,
    options.json,
    {
      command: "create",
      operation: "create",
      ok: true,
      type,
      output: file,
      name,
      ...(options.template ? { template: options.template } : {}),
    },
    `Created ${type} ${type === "instrument" && !options.template ? "scaffold" : "device"}: ${file}\n`,
  );
  return 0;
}
