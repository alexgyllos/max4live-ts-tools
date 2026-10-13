# max4live-ts-tools

A Node.js TypeScript library and `maxpat` CLI for reading, validating, safely editing, generating, formatting and structurally comparing Max `.maxpat` JSON patchers. Work with files or in-memory graphs, including embedded subpatchers. Preserve unknown JSON metadata and edit through immutable revisions.

**Release candidate:** `0.1.0-rc.1`. Source is public; npm publication remains disabled (`private: true`) and licensing is UNLICENSED pending separate MIT approval. There is no published npm package yet. Node 22.12+ within major 22 and Node 24 are the supported CI targets. Max compatibility remains pending the [verification procedure](https://github.com/alexgyllos/max4live-ts-tools/blob/main/docs/max-compatibility.md). Fixtures are synthetic, not certified Max exports.

This is offline JSON tooling. Binary `.amxd` device files, DSP execution, LOM control, device installation and Ableton automation are outside the initial release. Export/edit `.maxpat` through Max itself; renaming an `.amxd` does not convert it. This project is not affiliated with Ableton or Cycling '74.

## Development and installation

```sh
npm ci
npm run build
npm run typecheck
npm run lint
npm run format:check
npm test
npm run pack:check
npm run docs
npm run examples
npm run release:check
```

For a private local consumer, run `npm pack` then install the generated tarball in your application (`npm install /path/to/max4live-ts-tools-0.1.0-rc.1.tgz`). After an approved public release, installation will use the npm name; the registry currently returns 404, which is neither a reservation nor an ownership claim.

Development uses the TypeScript 7.0.2 native compiler (formerly `tsgo`, now exposed as `tsc`) and Oxfmt 0.73.0. `typescript-native` aliases the native compiler package; build, typecheck, lint, examples and packed declaration checks invoke it explicitly. TypeScript 6.0.3 is retained only for TypeDoc 0.28.20 and export inventory, which require its JavaScript compiler API. It does not compile the package.

## Quick start

```ts
import {
  PatchBuilder,
  writeFile,
  readFile,
  PatchEditor,
  diffPatches,
} from "max4live-ts-tools";

const patch = new PatchBuilder({
  rect: [0, 0, 600, 400],
  metadata: { fileversion: 1 },
})
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
const changed = PatchEditor.fromNormalized(original).updateBox("sink", {
  passthrough: { text: "print revised" },
});
console.log(diffPatches(original, changed.toNormalized()));
```

Use `max4live-ts-tools/core` for filesystem-free parsing/editing:

```ts
import {
  parsePatch,
  serializePatch,
  PatchEditor,
  queryPatch,
} from "max4live-ts-tools/core";
const patch = parsePatch('{"patcher":{"boxes":[]}}');
const editor = PatchEditor.fromNormalized(patch);
console.log(
  serializePatch(editor.toNormalized()),
  queryPatch(patch, { text: "print", match: "partial" }),
);
```

The root entrypoint adds `readFile`, `writeFile`, `PatchEditor.fromFile` and editor `write`. Builder/nested editors are core editors; pass their snapshots to `writeFile`. The package is ESM-only and ships JavaScript, declarations and a shebang executable. Port counts are explicit because Max objects may have dynamic behavior that cannot be inferred from text offline.

## CLI

```sh
maxpat validate --json example.maxpat
maxpat check example.maxpat
maxpat format example.maxpat           # no write; exit 1 if formatting differs
maxpat format --write example.maxpat
maxpat diff --json before.maxpat after.maxpat
maxpat --help
maxpat --version
```

Flags work in any order. Quote paths with spaces; use `--` for paths beginning with `-`. Validate/check are aliases. Exit 0 means success/equal, 1 means invalid graph/different/unformatted, 2 means invocation/parse/structural/IO error. JSON includes `schemaVersion: 1`; successful operation results go to stdout and exceptions to stderr. [Complete CLI, diff and schema reference](https://github.com/alexgyllos/max4live-ts-tools/blob/main/docs/cli.md).

## Safety and limitations

Back up valuable patches before editing. Supported valid data round-trips deeply, including root/patcher/wrapper/box/line fields, absent lines, saved attributes and nested graphs. Canonical output changes whitespace and object key order; array order and numeric negative zero are preserved. Duplicate IDs and non-JSON values are rejected. Structural checks always run, even with `skipValidation`; that option skips only graph rules. Reads validate structure by default and can opt into graph rejection; writes/serialization reject graph errors by default.

Writes create an exclusive unpredictable temp file beside the destination, close it and rename it atomically. Pre-rename failures preserve the original. New files use mode 0600; existing POSIX rwx permission bits are preserved (special bits are dropped). Symlink/nonregular destinations are rejected on inspection; rename never follows a destination symlink. Trusted, stable parent directories are required. Concurrent writes are last-successful-rename wins. On Windows, replacement retries only transient EPERM/EACCES/EBUSY rename failures, up to eight attempts with 560 ms total deliberate backoff. The synchronous call may block during that bounded backoff; it never unlinks the destination. Persistent denial remains a write error with the original cause and temporary-file cleanup. No lock, compare-and-swap, ACL/xattr preservation or crash/power-loss durability guarantee is made. OS cleanup failures are surfaced with their causes. See [bounded IO guarantees](https://github.com/alexgyllos/max4live-ts-tools/blob/main/docs/baseline.md).

Embedded scope paths are arrays of containing box IDs. `walkPatch`, `queryPatch`, `atPath` and `editAtPath` operate on inline patchers; external bpatcher references are never loaded. No external dependency resolution, object existence check or Max DSP/runtime validity is claimed. Resource limits and mutation/error contracts: [API guide](https://github.com/alexgyllos/max4live-ts-tools/blob/main/docs/api-contract.md). Generate HTML API reference using `npm run docs` (opens `docs/api/index.html`). Runnable examples: [create](https://github.com/alexgyllos/max4live-ts-tools/blob/main/examples/create.ts), [advanced/nested/rules/diff](https://github.com/alexgyllos/max4live-ts-tools/blob/main/examples/advanced.ts).

## Contributing and release status

See [CONTRIBUTING](https://github.com/alexgyllos/max4live-ts-tools/blob/main/CONTRIBUTING.md), [SECURITY](https://github.com/alexgyllos/max4live-ts-tools/blob/main/SECURITY.md), [community conduct](https://github.com/alexgyllos/max4live-ts-tools/blob/main/CODE_OF_CONDUCT.md), [CHANGELOG](https://github.com/alexgyllos/max4live-ts-tools/blob/main/CHANGELOG.md), [fixture provenance](https://github.com/alexgyllos/max4live-ts-tools/blob/main/docs/fixtures.md) and [release readiness](https://github.com/alexgyllos/max4live-ts-tools/blob/main/docs/release.md). Use GitHub issues for reproducible defects/ideas; no SLA or telemetry. Private security reporting instructions are in SECURITY.md. Owner review is required before merge, legal licensing, visibility change or publication.
