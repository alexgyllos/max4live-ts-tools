const common = "Options: --json, --help (-h), -- (end flags)\n";
const commands: Record<string, string> = {
  deps: "Usage: maxpat deps <file.maxpat|file.amxd> [--root <directory>] [--asset <file>] [--json]\nRepeat --root for explicit search roots; the first root contains the source and defines the distribution layout. Static discovery is not exhaustive.\n",
  package:
    "Usage: maxpat package <file.amxd> --output <directory> [--root <directory>] [--asset <file>] [--force] [--dry-run] [--json]\nCopies a validated unfrozen device and statically resolved companion files with preserved relative paths. Adjacent licence/notice files are included. --asset includes additional files (repeatable). --force replaces the whole output directory. --dry-run writes nothing and needs no --output. This does not Freeze a device.\n",
  create:
    "Usage: maxpat create <audio|midi|instrument> <output.amxd> [options]\nNative Live presentation is applied by default; --bare retains the original unstyled scaffold.\n--name <name> defaults to the output basename.\n--force permits atomic replacement; existing files are refused by default.\n--template sine creates a playable instrument; the default instrument is a silent scaffold.\n",
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
  create     Create an audio/MIDI device or instrument scaffold
  inspect    Inspect .maxpat or .amxd
  check      Validate structure and embedded graphs (alias: validate)
  format     Check or write .maxpat formatting
  diff       Compare .maxpat and/or .amxd patchers
  amxd       Build, extract or inspect a device
  deps       Discover static companion-file dependencies
  package    Package an unfrozen device and companion files
Use maxpat <command> --help for options; --version prints the version.
Exit codes: 0 success/equal; 1 invalid graph/different/unformatted; 2 invocation, parsing, unsupported format or I/O failure.
JSON schemaVersion is 1.
`) + common
  );
}
