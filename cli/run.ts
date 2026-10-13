import { readFileSync } from "node:fs";
import { readFile } from "../io/reader.js";
import { writeFile } from "../io/writer.js";
import { serializePatch } from "../io/parse.js";
import { validateGraph } from "../validate/graph.js";
import { diffPatches } from "../diff.js";
import { stableStringify } from "../io/serializer.js";
import { MaxpatStructuralError, MaxpatValidationError } from "../errors.js";
export type CliIO = {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
};
const help = `Usage: maxpat <command> [options] <files>
  validate <file>       Validate structure and all embedded graphs
  check <file>          Alias for validate
  format <file>         Check deterministic formatting (no writes)
  format --write <file> Apply validated atomic replacement
  diff <file-a> <file-b> ID-sensitive structural diff
Options: --json, --write (format only), --help, --version, -- (end flags)
Exit codes: 0 success/equal/formatted; 1 invalid graph/different/unformatted;
2 invocation, JSON, structural or I/O failure. JSON schemaVersion is 1.
`;
/** Dispatcher used by the actual installed binary. Output is one JSON document or text. */
export function runCli(args: string[], version: string, io: CliIO): number {
  let json = false,
    write = false,
    showHelp = false,
    showVersion = false,
    endFlags = false;
  const positional: string[] = [];
  const error = (e: unknown, code = 2): number => {
    const message = e instanceof Error ? e.message : String(e);
    const details =
      e instanceof MaxpatValidationError
        ? { diagnostics: e.diagnostics }
        : e instanceof MaxpatStructuralError
          ? { issues: e.issues }
          : {};
    io.stderr(
      json
        ? stableStringify({
            schemaVersion: 1,
            ok: false,
            error: {
              name: e instanceof Error ? e.name : "Error",
              message,
              ...details,
            },
          }) + "\n"
        : message + "\n",
    );
    return code;
  };
  // Recognize JSON even on invocation errors, unless it was protected by --.
  const flagsEnd = args.indexOf("--");
  json = args
    .slice(0, flagsEnd < 0 ? args.length : flagsEnd)
    .includes("--json");
  try {
    for (const arg of args) {
      if (endFlags) {
        positional.push(arg);
        continue;
      }
      if (arg === "--") {
        endFlags = true;
        continue;
      }
      if (arg === "--json") {
        json = true;
        continue;
      }
      if (arg === "--write") {
        write = true;
        continue;
      }
      if (arg === "--help" || arg === "-h") {
        showHelp = true;
        continue;
      }
      if (arg === "--version" || arg === "-v") {
        showVersion = true;
        continue;
      }
      if (arg.startsWith("-"))
        throw new Error(
          `Unknown option ${arg}; use -- for paths beginning with -`,
        );
      positional.push(arg);
    }
    if (showHelp) {
      io.stdout(
        json ? stableStringify({ schemaVersion: 1, help }) + "\n" : help,
      );
      return 0;
    }
    if (showVersion) {
      if (positional.length || write)
        throw new Error("--version takes no command/files");
      io.stdout(
        json
          ? stableStringify({ schemaVersion: 1, version }) + "\n"
          : version + "\n",
      );
      return 0;
    }
    const [command, ...files] = positional;
    if (!["validate", "check", "format", "diff"].includes(command))
      throw new Error("Expected validate, check, format or diff; use --help");
    if (files.length !== (command === "diff" ? 2 : 1))
      throw new Error(
        `${command} requires ${command === "diff" ? "two files" : "one file"}`,
      );
    if (write && command !== "format")
      throw new Error("--write is only supported by format");
    const patch = readFile(files[0]);
    if (command === "validate" || command === "check") {
      const result = validateGraph(patch);
      io.stdout(
        json
          ? stableStringify({ schemaVersion: 1, command, ...result }) + "\n"
          : result.diagnostics
              .map(
                (d) =>
                  `${d.severity} ${d.code}: ${d.message}${d.location ? ` ${JSON.stringify(d.location)}` : ""}`,
              )
              .join("\n") +
              (result.diagnostics.length ? "\n" : "") +
              (result.ok ? "Valid patch\n" : "Invalid graph\n"),
      );
      return result.ok ? 0 : 1;
    }
    if (command === "diff") {
      const result = diffPatches(patch, readFile(files[1]));
      io.stdout(
        json
          ? stableStringify({ schemaVersion: 1, command, ...result }) + "\n"
          : result.equal
            ? "Structurally equal\n"
            : result.changes
                .map(
                  (c) =>
                    `${c.kind} ${c.path}: ${Object.hasOwn(c, "before") ? stableStringify(c.before) : "<absent>"} -> ${Object.hasOwn(c, "after") ? stableStringify(c.after) : "<absent>"}`,
                )
                .join("\n") + "\n",
      );
      return result.equal ? 0 : 1;
    }
    const formatted = serializePatch(patch);
    const existing = readFileSync(files[0], "utf8");
    const changed = formatted !== existing;
    if (write && changed) writeFile(files[0], patch);
    io.stdout(
      json
        ? stableStringify({
            schemaVersion: 1,
            command,
            ok: true,
            changed,
            written: write && changed,
          }) + "\n"
        : changed
          ? write
            ? "Formatted patch\n"
            : "Formatting differs\n"
          : "Already formatted\n",
    );
    return changed && !write ? 1 : 0;
  } catch (e) {
    return error(e, e instanceof MaxpatValidationError ? 1 : 2);
  }
}
