# max4live-ts-tools

TypeScript tools for working with Max patcher files: parse, validate, edit,
generate, format and compare `.maxpat` JSON, including embedded subpatchers.
Requires Node 24. ESM only.

## Installation

The package is not yet published to npm. Build a tarball from this repository:

```sh
git clone https://github.com/alexgyllos/max4live-ts-tools.git
cd max4live-ts-tools
npm ci
npm pack
```

Install the resulting `max4live-ts-tools-0.1.0-rc.1.tgz` in your application with
`npm install /path/to/max4live-ts-tools-0.1.0-rc.1.tgz`.

## Usage

```ts
import {
  PatchBuilder,
  PatchEditor,
  readFile,
  writeFile,
  diffPatches,
} from "max4live-ts-tools";

const patch = new PatchBuilder()
  .object({
    id: "source",
    text: "loadbang",
    at: [20, 20],
    numinlets: 0,
    numoutlets: 1,
  })
  .object({
    id: "sink",
    text: "print example",
    at: [20, 80],
    numinlets: 1,
    numoutlets: 0,
  })
  .connect(["source", 0], ["sink", 0])
  .toNormalized();

writeFile("example.maxpat", patch);
const original = readFile("example.maxpat");
const edited = PatchEditor.fromNormalized(original).updateBox("sink", {
  passthrough: { text: "print revised" },
});
writeFile("edited.maxpat", edited.toNormalized());
console.log(diffPatches(original, edited.toNormalized()));
```

`max4live-ts-tools/core` provides filesystem-free parsing, serialisation,
validation, editing, builders, traversal and diffing. The root entrypoint adds
`readFile`, `writeFile`, `PatchEditor.fromFile()` and editor `write()`.
Editor revisions are immutable; returned snapshots and query results are copies.

Use `parsePatch` for JSON text and `parsePatchObject` for JSON objects.
Reads check structure; pass `{ validateGraph: true }` to also reject graph errors.
`validateGraph` returns diagnostics and accepts rule overrides and custom rules.
Writes and serialisation reject graph errors by default; `{ skipValidation: true }`
skips graph rules only. Duplicate IDs and non-JSON data are always rejected.

Object port counts must be explicit. Removing an object removes its connections;
reducing a connected port count throws. Embedded paths are arrays of containing
box IDs: `walkPatch`, `queryPatch`, `atPath` and `editAtPath` work within those scopes.
External bpatcher files are preserved but not loaded.

## CLI

After installation, use `npx --no-install maxpat` in your application:

```sh
npx --no-install maxpat check --json example.maxpat
npx --no-install maxpat format example.maxpat
npx --no-install maxpat format --write example.maxpat
npx --no-install maxpat diff --json example.maxpat edited.maxpat
npx --no-install maxpat --help
```

`validate` and `check` are aliases. Format checks without writing unless `--write`
is supplied. Quote paths with spaces; use `--` for names beginning with `-`.
Exit codes: **0** success/equal/formatted, **1** invalid graph/different/unformatted,
**2** invocation, parsing, structure or I/O error.

`--json` emits one document with `schemaVersion: 1`. Validation returns
`command`, `ok`, `diagnostics`; format returns `command`, `ok`, `changed`, `written`;
diff returns `command`, `mode: "structural"`, `equal`, `changes`.
Operation results go to stdout; exceptions go to stderr with `ok: false` and
`error` details. Each change has `kind`, `path` and optional `before`/`after` values.
Absent fields mean additions/removals; null is a present value.

Diffs compare IDs, metadata, field presence, nested graphs and array order;
whitespace and object key order are ignored. Connections match content first,
then endpoints, retaining duplicates and reporting metadata edits separately.
Rewiring removes/adds a connection; relative reorderings appear at `lineOrder`
with original connection indices. Added/updated paths use new indices and removed
paths use original indices. Paths describe changes; they are not JSON Patch operations.

## File behaviour and limitations

Unknown JSON fields, array order and negative zero are preserved. Serialisation
normalises whitespace and object key order. Inputs are bounded: 40 MiB files,
20 Mi UTF-16 code units of text, 128 JSON levels, 24 nested patcher levels,
100,000 boxes and 200,000 connections per scope.

Writes use an exclusive temporary file beside the destination, close it, then
rename it over the destination. Failures before rename preserve the original;
concurrent replacements use the last successful rename. Symlink destinations are
rejected; use stable parent directories. New files use mode 0600; existing POSIX
permission bits are preserved. Replacement does not provide power-loss durability.
On Windows, transient rename failures retry up to eight attempts with 560 ms total
scheduled waiting. These APIs are synchronous; use a worker for latency-sensitive
Electron/UI calls.

The toolkit handles `.maxpat` JSON, not binary `.amxd` devices or Max execution.
Max save/reopen compatibility remains unverified.
This project is not affiliated with Ableton or Cycling '74.

## Development

Use Node 24 and `npm ci`. Run `npm run verify` for formatting, typechecks, tests,
examples and packed-consumer checks; `npm run format` applies Oxfmt formatting.
See [CONTRIBUTING](https://github.com/alexgyllos/max4live-ts-tools/blob/main/CONTRIBUTING.md)
and the runnable [examples](https://github.com/alexgyllos/max4live-ts-tools/tree/main/examples).
Licensed under [MIT](LICENSE).
