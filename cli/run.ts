import { parseArgs, wantsJson, requireFiles } from "./args.js";
import { output, errorOutput, type CliIO } from "./output.js";
import { commandHelp } from "./help.js";
import { inspect } from "./commands/inspect.js";
import { validate } from "./commands/validate.js";
import { format } from "./commands/format.js";
import { diff } from "./commands/diff.js";
import { amxd } from "./commands/amxd.js";
import { create } from "./commands/create.js";
import { dependencies } from "./commands/package.js";
export type { CliIO } from "./output.js";
/** Dispatcher used by the installed binary. Output is one JSON document or text. */
export function runCli(args: string[], version: string, io: CliIO): number {
  try {
    const options = parseArgs(args);
    const { json, write, includeContainer, deviceType } = options;
    const [command, ...files] = options.positional;
    if (options.help) {
      const help = commandHelp(command);
      output(io, json, { help }, help);
      return 0;
    }
    if (options.version) {
      if (
        options.positional.length ||
        options.force ||
        options.name !== undefined ||
        options.template !== undefined ||
        write ||
        includeContainer ||
        deviceType !== undefined ||
        options.roots.length ||
        options.assets.length ||
        options.output !== undefined ||
        options.dryRun
      )
        throw new Error("--version takes no command/files");
      output(io, json, { version }, version + "\n");
      return 0;
    }
    if (
      command !== "create" &&
      (options.name !== undefined || options.template !== undefined)
    )
      throw new Error("--name and --template are only supported by create");
    if (options.force && !["create", "package"].includes(command))
      throw new Error("--force is only supported by create or package");
    if (
      (options.roots.length || options.assets.length) &&
      !["deps", "package"].includes(command)
    )
      throw new Error(
        "--root and --asset are only supported by deps or package",
      );
    if (
      (options.output !== undefined || options.dryRun) &&
      command !== "package"
    )
      throw new Error("--output and --dry-run are only supported by package");
    if (write && command !== "format")
      throw new Error("--write is only supported by format");
    if (includeContainer && command !== "diff")
      throw new Error("--include-container is only supported by diff");
    if (deviceType !== undefined && command !== "amxd")
      throw new Error("--type is only supported by amxd build");
    if (command === "create") return create(files, options, io);
    if (command === "deps" || command === "package")
      return dependencies(command, files, options, io);
    if (command === "amxd") return amxd(files, deviceType, json, io);
    if (!["inspect", "validate", "check", "format", "diff"].includes(command))
      throw new Error(
        "Expected inspect, validate, check, format, diff, create, amxd, deps or package; use --help",
      );
    requireFiles(command, files, command === "diff" ? 2 : 1);
    switch (command) {
      case "inspect":
        return inspect(files[0], json, io);
      case "check":
      case "validate":
        return validate(command, files[0], json, io);
      case "diff":
        return diff(files, includeContainer, json, io);
      default:
        return format(files[0], write, json, io);
    }
  } catch (e) {
    return errorOutput(io, wantsJson(args), e);
  }
}
