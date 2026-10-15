# max4live-ts-tools

TypeScript tools for working with Max patchers and Max for Live devices:
parse, validate, edit, generate, format and compare `.maxpat` JSON;
read and write supported `.amxd` containers. Requires Node 24. ESM only.

## Installation

```sh
npm install max4live-ts-tools
```

## Create a patcher

```ts
import { PatchBuilder, writeFile } from "max4live-ts-tools";

const patch = new PatchBuilder()
  .object({ id: "source", text: "loadbang", numinlets: 0, numoutlets: 1 })
  .object({ id: "sink", text: "print example", numinlets: 1, numoutlets: 0 })
  .connect(["source", 0], ["sink", 0])
  .toNormalized();
writeFile("example.maxpat", patch);
```

`max4live-ts-tools/core` provides filesystem-free parsing, serialisation,
validation, editing, builders, traversal and diffing. The Node root entrypoint
adds file I/O and `.amxd` support. Editor revisions are immutable; returned
snapshots and query results are copies.

Use `parsePatch` for JSON text, `parsePatchObject` for objects and `readFile` for
files. Reads check structure; `{ validateGraph: true }` also rejects graph errors.
`validateGraph` returns diagnostics and accepts rule overrides and custom rules.
Writes reject graph errors by default; `{ skipValidation: true }` skips only graph
rules. Duplicate IDs and non-JSON data are always rejected.

## Create and edit a Max for Live device

```ts
import {
  createMaxForLiveDevice,
  readAmxd,
  writeAmxd,
  PatchEditor,
} from "max4live-ts-tools";

// "audio": stereo passthrough; "midi": MIDI passthrough;
// "instrument": MIDI input and audio output, ready to add your synthesis graph.
const device = createMaxForLiveDevice({ type: "audio", name: "My Effect" });
writeAmxd("My Effect.amxd", device);

const loaded = readAmxd("My Effect.amxd");
const editor = PatchEditor.fromNormalized(loaded.patch).updateBox("input", {
  patchingRect: [40, 40, 80, 22],
});
writeAmxd("My Effect.amxd", { ...loaded, patch: editor.toNormalized() });
```

Templates use `input` and `output` object IDs. Use the existing `PatchEditor` or
`PatchBuilder` to add objects and connections; object port counts are explicit.
Removing a box removes its connections; reducing a connected port count throws.
The [device examples](https://github.com/alexgyllos/max4live-ts-tools/blob/main/examples/devices.ts)
also generate a velocity-controlled sine instrument.

`decodeAmxd(bytes)` and `encodeAmxd(device)` work on `Uint8Array`s, using
[@tsln/amxd](https://github.com/tsln-lab/max-packages/tree/main/packages/amxd).
Keep the decoded `container` when editing to retain version, metadata and ordered
binary chunks. Unchanged valid devices round-trip byte-identically; edits preserve
unknown patcher fields, embedded patchers and opaque chunks, including after `ptch`.
Supported devices use version 4 `ampf` with a UTF-8 JSON `ptch` payload.
Frozen `mx@c` archives and encrypted `ciph` variants are rejected explicitly.
External dependencies are not bundled by this toolkit.

## CLI

After installation, run `npx --no-install maxpat` in your application:

```sh
npx --no-install maxpat inspect effect.amxd --json
npx --no-install maxpat check effect.amxd
npx --no-install maxpat check --json example.maxpat
npx --no-install maxpat format --write example.maxpat
npx --no-install maxpat diff --json before.maxpat after.maxpat
npx --no-install maxpat diff original.amxd modified.amxd
npx --no-install maxpat diff effect.amxd effect.maxpat
npx --no-install maxpat amxd build effect.maxpat effect.amxd --type audio
npx --no-install maxpat amxd extract effect.amxd effect.maxpat
npx --no-install maxpat amxd inspect effect.amxd --json
npx --no-install maxpat --help
```

Build accepts `--type audio`, `midi` or `instrument`. Start with
`createMaxForLiveDevice()` or a device patch exported from Max: build rejects
missing project dictionaries, missing/mismatched `project.amxdtype`, invalid
graphs and missing built-in I/O. Audio requires `plugin~` and `plugout~`; MIDI
requires MIDI input/output objects (such as `midiin`/`midiout`); instruments
require `plugout~`. Embedded patchers are checked; external abstractions are not
loaded. This preflight does not replace testing in Live. Extract preserves
structurally valid patchers even with broken connections, for repair.

`inspect`, `validate`, `check` and `diff` accept supported `.amxd` and `.maxpat`
inputs. Device headers identify binary inputs; mismatched extensions are rejected.
Inspection reports recursive counts and graph status without dumping the patcher.
Validation checks container/project consistency and all embedded graphs without
requiring built-in I/O objects or resolving external abstractions.
`amxd inspect` remains an alias. Use `<command> --help` for command-specific options.

Diff compares patcher structure by default: an unmodified device equals its
extracted `.maxpat`. `diff a.amxd b.amxd --include-container` also compares device
type, container version, metadata, binary chunks and their order. JSON keeps
patcher `changes` and optional `container.changes` separate; embedded JSON
whitespace is ignored and patcher payload changes are counted once.

`validate` and `check` are aliases. Format accepts `.maxpat` only and checks without
writing unless `--write` is supplied. Quote paths with spaces; use `--` for names
beginning with `-`. Exit codes: **0** success/equal, **1** invalid graph/different/
unformatted, **2** invocation, parsing, unsupported format or I/O error.

`--json` emits one document with `schemaVersion: 1`. Operation results go to stdout;
exceptions go to stderr with `ok: false` and `error` details, including `error.code`
when available (for example `UNSUPPORTED_AMXD`). Diff changes have
`kind`, `path` and optional `before`/`after`; absence means addition/removal.
Diffs compare IDs, metadata, field presence, nested graphs and array order, ignoring
whitespace and key order. Connections match content then endpoints, retaining
duplicates. Rewiring removes/adds a cord; relative reorderings appear at `lineOrder`.
Added/updated paths use new indices; removed paths use original indices. These are
change descriptions, not JSON Patch operations.

## Typed Max runtime example

```sh
npm ci
npm run example:live-tempo
```

Load `examples/generated/live-tempo/Live Tempo.amxd` on an audio track. It preserves
stereo audio and displays Live's tempo, including changes. Keep `tempo.js` beside
the device or in Max's search path; this unfrozen device is not self-contained.
Max's native freezing can package dependencies for distribution, but frozen devices
cannot be edited with this codec.

The separate Max-only configuration uses `@tsln/max-types` and `@tsln/lom-types`.
The script bundles `@tsln/live-object`, accessing Live only after `live.thisdevice`
initialises the device. Node library code imports none of these runtime globals.
See the [@tsln packages and scaffolder](https://github.com/tsln-lab/max-packages).

## File behaviour and development

Unknown fields, array order and negative zero survive parsing and serialisation;
output normalises whitespace and object key order. Embedded paths are arrays of
containing box IDs; use `walkPatch`, `queryPatch`, `atPath` and `editAtPath`.
External bpatcher files are preserved but not loaded. Limits: 40 MiB `.maxpat`,
64 MiB `.amxd`, 20 Mi UTF-16 text units, 128 JSON levels, 24 nested patcher levels,
100,000 boxes and 200,000 connections per scope.

Writes validate before creating an exclusive temporary file, close it and rename
it over the destination. Pre-rename failures preserve the original; concurrent
writes use the last successful rename. Symlinks are rejected; use stable parents.
New files use mode 0600; existing POSIX permission bits are preserved. Replacement
is not power-loss durable. Windows retries can wait 560 ms; these APIs are
synchronous, so use a worker for latency-sensitive UI calls.

The examples were tested in Live 12.4.6 with Max 9.1.5, including save/reload,
stereo playback, MIDI note-on/off, tempo observation and nested patcher editing.
This project is not affiliated with Ableton or Cycling '74.

Run `npm run verify` for formatting, types, tests, examples and installed-package
checks. `npm run format` applies Oxfmt. See
[CONTRIBUTING](https://github.com/alexgyllos/max4live-ts-tools/blob/main/CONTRIBUTING.md).
Licensed under [MIT](LICENSE).
