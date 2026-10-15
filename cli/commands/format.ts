import { readFileSync } from "node:fs";
import { readFile } from "../../io/reader.js";
import { writeFile } from "../../io/writer.js";
import { serializePatch } from "../../io/parse.js";
import { output, type CliIO } from "../output.js";
export function format(
  file: string,
  write: boolean,
  json: boolean,
  io: CliIO,
): number {
  const patch = readFile(file);
  const changed = serializePatch(patch) !== readFileSync(file, "utf8");
  if (write && changed) writeFile(file, patch);
  output(
    io,
    json,
    { command: "format", ok: true, changed, written: write && changed },
    changed
      ? write
        ? "Formatted patch\n"
        : "Formatting differs\n"
      : "Already formatted\n",
  );
  return changed && !write ? 1 : 0;
}
