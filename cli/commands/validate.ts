import { validateGraph } from "../../validate/graph.js";
import { loadPatch } from "../load.js";
import { output, type CliIO } from "../output.js";
export function validate(
  command: string,
  file: string,
  json: boolean,
  io: CliIO,
): number {
  const result = validateGraph(loadPatch(file).patch);
  const diagnostics = result.diagnostics
    .map(
      (d) =>
        `${d.severity} ${d.code}: ${d.message}${d.location ? ` ${JSON.stringify(d.location)}` : ""}`,
    )
    .join("\n");
  output(
    io,
    json,
    { command, ...result },
    (diagnostics ? diagnostics + "\n" : "") +
      (result.ok ? "Valid patch\n" : "Invalid graph\n"),
  );
  return result.ok ? 0 : 1;
}
