const common = "Options: --json, --help (-h), -- (end flags)\n";
const commands: Record<string, string> = {
  inspect:
    "Usage: maxpat inspect <file.maxpat|file.amxd> [--json]\nShow counts, validation status and device metadata.\n",
  validate:
    "Usage: maxpat validate <file.maxpat|file.amxd> [--json]\nValidate structure, metadata and all embedded graphs. Alias: check.\n",
  check:
    "Usage: maxpat check <file.maxpat|file.amxd> [--json]\nAlias for validate.\n",
  format:
    "Usage: maxpat format <file.maxpat> [--write] [--json]\nCheck deterministic JSON formatting; --write applies atomic replacement.\n",
  diff: "Usage: maxpat diff <file-a> <file-b> [--include-container] [--json]\nCompare patcher structure across .maxpat and .amxd.\n--include-container: also compare metadata and chunks; requires two .amxd inputs.\n",
  amxd: "Usage: maxpat amxd <build|extract|inspect> [files] [options]\n  build <in.maxpat> <out.amxd> --type audio|midi|instrument\n  extract <in.amxd> <out.maxpat>\n  inspect <in.amxd> (alias for inspect)\n",
};
export function commandHelp(command?: string): string {
  if (command && !commands[command])
    throw new Error(`Unknown command ${command}; use --help`);
  return (
    (command
      ? commands[command]
      : `Usage: maxpat <command> [options] <files>
  inspect    Inspect .maxpat or .amxd
  check      Validate structure and embedded graphs (alias: validate)
  format     Check or write .maxpat formatting
  diff       Compare .maxpat and/or .amxd patchers
  amxd       Build, extract or inspect a device
Use maxpat <command> --help for options; --version prints the version.
Exit codes: 0 success/equal; 1 invalid graph/different/unformatted; 2 invocation, parsing, unsupported format or I/O failure.
JSON schemaVersion is 1.
`) + common
  );
}
