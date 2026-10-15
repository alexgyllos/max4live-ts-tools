export type CliArgs = {
  positional: string[];
  json: boolean;
  write: boolean;
  includeContainer: boolean;
  help: boolean;
  version: boolean;
  deviceType?: string;
};
export function wantsJson(args: string[]): boolean {
  const end = args.indexOf("--");
  return args.slice(0, end < 0 ? args.length : end).includes("--json");
}
export function parseArgs(args: string[]): CliArgs {
  const result: CliArgs = {
    positional: [],
    json: wantsJson(args),
    write: false,
    includeContainer: false,
    help: false,
    version: false,
  };
  let end = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (end) {
      result.positional.push(arg);
      continue;
    }
    if (arg === "--") {
      end = true;
      continue;
    }
    if (arg === "--type") {
      if (
        result.deviceType !== undefined ||
        !args[i + 1] ||
        args[i + 1].startsWith("-")
      )
        throw new Error("--type requires one device type");
      result.deviceType = args[++i];
    } else if (arg === "--json") result.json = true;
    else if (arg === "--write") result.write = true;
    else if (arg === "--include-container") result.includeContainer = true;
    else if (arg === "--help" || arg === "-h") result.help = true;
    else if (arg === "--version" || arg === "-v") result.version = true;
    else if (arg.startsWith("-"))
      throw new Error(
        `Unknown option ${arg}; use -- for paths beginning with -`,
      );
    else result.positional.push(arg);
  }
  return result;
}
export function requireFiles(
  command: string,
  files: string[],
  count: number,
): void {
  if (files.length !== count)
    throw new Error(
      `${command} requires ${count === 1 ? "one file" : "two files"}`,
    );
}
