# API and CLI reference

Use the Node ESM root entrypoint for file I/O and devices. The
`max4live-ts-tools/core` entrypoint provides filesystem-free parsing,
serialisation, validation, immutable editing, builders, traversal and diffing.

## Patches and editing

```ts
import { PatchBuilder, PatchEditor, writeFile } from "max4live-ts-tools";

const patch = new PatchBuilder()
  .add("loadbang", { id: "start" })
  .add("message", { id: "message", text: "Hello", at: [20, 60] })
  .add("print", { id: "output", at: [20, 100] })
  .connect(["start", 0], ["message", 0])
  .connect(["message", 0], ["output", 0])
  .toNormalized();
const edited = PatchEditor.fromNormalized(patch).updateBox("output", {
  patchingRect: [40, 100, 80, 22],
});
writeFile("example.maxpat", edited.toNormalized());
```

`add()` supplies Max-verified defaults for common objects. For arbitrary objects
or dynamic ports, use `object()` with explicit port counts. See
[builders](../examples/create.ts), [editing and traversal](../examples/advanced.ts)
and [device generation](../examples/devices.ts). Embedded paths are arrays of
containing box IDs; use `walkPatch`, `queryPatch`, `atPath` and `editAtPath`.
Revisions are immutable; returned snapshots and query results are copies.
Removing a box removes its connections; reducing a connected port count throws.

Use `parsePatch` for JSON text, `parsePatchObject` for objects and `readFile` for
files. Reads check structure; `{ validateGraph: true }` also rejects graph errors.
`validateGraph` returns diagnostics and accepts rule overrides and custom rules.
Writes reject graph errors unless `{ skipValidation: true }` is supplied.
Duplicate IDs and non-JSON data are always rejected. Unknown fields, array order
and negative zero survive serialisation; whitespace and object key order normalise.
External bpatchers are preserved but not loaded by graph validation.

## Devices and Live parameters

```ts
import {
  createMaxForLiveDevice,
  addLiveParameter,
  writeAmxd,
} from "max4live-ts-tools";

const device = addLiveParameter(createMaxForLiveDevice({ type: "audio" }), {
  id: "gain",
  name: "Gain",
  type: "float",
  min: 0,
  max: 1,
  default: 0.5,
});
writeAmxd("Gain.amxd", device);
```

Connect the dial's first outlet to your processing graph; adding a parameter
alone does not apply gain. Float parameters support finite ranges, initial values,
automation and saved state. Names and scripting names must be unique. Automatic
presentation finds available space; explicit geometry is retained. See the
[parameter example](../examples/parameters.ts) and
[native presentation](native-presentation.md).

Audio/MIDI templates pass through their inputs; instruments start silent.
Templates use `input` and `output` object IDs. `readAmxd`/`writeAmxd` handle files;
`decodeAmxd`/`encodeAmxd` handle bytes. Retain the decoded `container` when editing
to preserve metadata and ordered opaque chunks. Unchanged valid devices round-trip
byte-identically. The codec uses `@tsln/amxd` and supports version-4 `ampf` with a
UTF-8 JSON `ptch` payload; frozen `mx@c` and encrypted `ciph` variants are rejected.
Use [companion-file packaging](packaging.md) for dependencies.

## CLI

```sh
maxpat create audio MyEffect.amxd
maxpat create audio Bare.amxd --bare
maxpat create instrument Sine.amxd --template sine
maxpat check MyEffect.amxd --json
maxpat inspect MyEffect.amxd --json
maxpat format example.maxpat --write
maxpat diff before.amxd after.amxd --include-container
maxpat amxd build effect.maxpat effect.amxd --type audio
maxpat amxd extract effect.amxd effect.maxpat
maxpat deps MyEffect.amxd
maxpat package MyEffect.amxd --output distribution
maxpat --help
```

Use `npx --no-install maxpat` after local installation, or `<command> --help` for
options. `validate` aliases `check`; `amxd inspect` aliases `inspect`. Quote paths
with spaces; use `--` before names beginning with `-`. Creation refuses existing
files without `--force`; `--name` overrides the output basename. Creation applies
native presentation by default; `--bare` keeps the unstyled scaffold.

Build checks device metadata, matching type, graph validity and built-in I/O:
audio needs `plugin~`/`plugout~`, MIDI needs MIDI input/output, instruments need
`plugout~`. Extract allows structurally valid patches with broken connections for
repair. Check/inspect/diff accept both formats; format accepts `.maxpat` only and
checks without writing unless `--write` is supplied. Validation checks embedded
graphs and container/project consistency, without resolving external abstractions.

Diff compares IDs, metadata, field presence and nested graphs, ignoring whitespace
and key order. Connections match content then endpoints, retaining duplicates;
rewiring removes/adds a cord, relative reordering appears at `lineOrder`.
Added/updated paths use new indices; removed paths use original indices. These are
change descriptions, not JSON Patch operations. `--include-container` additionally
compares two devices' type, version, metadata and actual opaque chunk bytes, reporting
bounded summaries without dumping binary data.

Exit codes: **0** success/equal; **1** invalid graph/different/unformatted;
**2** invocation, parsing, unsupported format or I/O error. `--json` emits one
`schemaVersion: 1` document. Results go to stdout; exceptions go to stderr with
`ok: false` and `error.message`/optional `error.code`. Diff output has `changes`
and optional `container.changes`; each change has `kind`, `path` and optional
`before`/`after` (absence means addition/removal).

## File contracts

Limits: 40 MiB `.maxpat`, 64 MiB `.amxd`, 20 Mi UTF-16 text units, 128 JSON levels,
24 nested patcher levels, 100,000 boxes and 200,000 connections per scope.

File writers accept `{ overwrite: false }` to refuse existing files atomically
using a same-filesystem hard link. Unsupported filesystems fail safely. Otherwise,
validated bytes are written to an exclusive adjacent temporary file and renamed
over the destination; pre-rename failures preserve the original. Concurrent writes
use the last successful rename. Symlinks are rejected; use stable parents.
New files use mode 0600; existing POSIX permissions are preserved. Replacement is
not power-loss durable. Synchronous Windows rename retries can wait 560 ms; use a
worker for latency-sensitive callers. `overwrite` is a file option, not an encoding
or serialisation option.
