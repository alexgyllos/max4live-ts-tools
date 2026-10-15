import { walkPatch } from "../../nested.js";
import { validateGraph } from "../../validate/graph.js";
import { loadPatch } from "../load.js";
import { output, type CliIO } from "../output.js";
export function inspect(
  file: string,
  json: boolean,
  io: CliIO,
  alias = false,
): number {
  const loaded = loadPatch(file);
  if (alias && loaded.format !== "amxd")
    throw new Error("amxd inspect requires an .amxd device");
  const scopes = [...walkPatch(loaded.patch)];
  const name = loaded.patch.patcherMeta.passthrough.title;
  const result = {
    format: loaded.format,
    boxes: scopes.reduce((n, s) => n + s.patch.boxes.size, 0),
    connections: scopes.reduce((n, s) => n + s.patch.lines.length, 0),
    nestedPatchers: scopes.length - 1,
    validation: validateGraph(loaded.patch),
    ...(loaded.format === "amxd"
      ? {
          type: loaded.device.type,
          containerVersion: loaded.device.container!.version,
        }
      : {}),
    ...(typeof name === "string" ? { name } : {}),
    // Retained for v0.1.0 amxd inspect consumers: these are root-scope counts.
    patcher: {
      boxes: loaded.patch.boxes.size,
      connections: loaded.patch.lines.length,
      scopes: scopes.length,
      ...(typeof name === "string" ? { name } : {}),
    },
  };
  const text = `${result.format}${"type" in result ? ` ${result.type} device (container v${result.containerVersion})` : " patch"}${typeof name === "string" ? `: ${name}` : ""}\n${result.boxes} boxes, ${result.connections} connections, ${result.nestedPatchers} nested patchers; ${result.validation.ok ? "valid" : "invalid graph"}\n`;
  output(
    io,
    json,
    {
      command: alias ? "amxd" : "inspect",
      ...(alias ? { operation: "inspect" } : {}),
      ok: true,
      ...result,
    },
    text,
  );
  return 0;
}
