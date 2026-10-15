# Companion files and native Freeze

`deps` and `package` are development-candidate commands targeting a future minor
release; npm `0.2.0` does not include them. Build the reviewed source candidate:

```sh
npm ci
npm run build
node dist/cli/index.js deps MyDevice.amxd --json
node dist/cli/index.js package MyDevice.amxd --output dist/MyDevice
```

Once installed from a candidate tarball, the same commands are available through
`npx --no-install maxpat`. Packaging creates an **unfrozen companion-file
distribution**, not a self-contained frozen device.

The default root is the device's directory. `--root <directory>` sets the project
layout root; repeat it to add explicit search roots. The device must be inside
the first root. Files retain the literal relative relationships used by the
device/abstractions. For example, a device under `devices/` referencing
`../scripts/helper.js` is distributed under `devices/` alongside `scripts/`.
Files resolved from an additional search root are placed at the relative paths
used by their referring patcher, not under an arbitrary `dependencies/` folder.

```sh
node dist/cli/index.js package project/devices/MyDevice.amxd \
  --root project --output dist/MyDevice \
  --asset project/media/texture.png --asset project/THIRD-PARTY.txt \
  --dry-run --json
```

Remove `--dry-run` to write. `--asset` is repeatable and includes individual files;
it never recursively copies directories. Adjacent `LICENSE`, `LICENCE`, `COPYING`
and `NOTICE` files (including suffixed names such as `LICENSE.tsln`) are collected.
Review attribution yourself and explicitly include anything else required.

Discovery covers dependency caches/project contents, embedded patchers, external
bpatchers and local abstractions, `poly~`/`pfft~` filename arguments,
`js`/`v8`/`node.script` scripts, and common saved media references including
`buffer~ @file` (`@audiofile`). `poly~ @patchername` is also recognised.
Both slash styles are normalised when resolving source files. It distinguishes missing, ambiguous and dynamically unresolved
references. It does not evaluate JavaScript imports, runtime messages, constructed
names or Max's global search path. Unknown bare object names are not assumed to be
missing files. A successful scan is not proof that all runtime dependencies were
found. Unresolved references block packaging; native externals may need separate
platform-specific installation/licensing.

Output contains a relative-path SHA-256 manifest, `maxpat-package.json`. Source
files are preserved. Copied patchers remove stale dependency caches and reset
global project search hints so they cannot silently resolve development copies.
Missing/ambiguous dependencies, symlinks, root escapes, collisions and nonportable
filenames fail before publication. Limits are 64 MiB per file, 256 MiB total,
1024 files, 4096 references and 16 search roots.

Existing output is refused; `--force` explicitly replaces the **entire directory**.
All bytes are staged and checked before claiming output. A failed move rolls back
the owned partial output and restores the previous directory where possible;
recovery/cleanup failures identify retained locations. Directory publication is
not atomic or power-loss durable. Use stable parent directories and do not edit
source files during packaging. JSON follows schemaVersion 1; exit codes remain
0 success, 1 unresolved dependencies/invalid graph, 2 invocation/format/I/O error.

A cache-free companion distribution was opened in Max 9.1.5 on macOS on
2026-10-16 with development files temporarily unavailable. Flat `node.script`,
`poly~`, `pfft~` and `buffer~ @file` references loaded successfully: the script
and both patchers printed their markers and the buffer reported 100 ms.
Subfolder filename probes did not resolve in that standalone Max session.
Preserving a directory layout does not validate Max's runtime path semantics;
qualify your actual references in Live/Max before distributing. The CLI does not
rewrite object filename arguments or configure Max's search path.

## Native Freeze

The supported workflow is in the Max for Live editor:

1. Load the unfrozen device from its complete companion-file distribution in Live.
2. Choose **Edit in Max**. Use **File → List Externals and Subpatcher Files** and
   the containing project to inspect/add dependencies, including runtime assets
   static analysis cannot identify.
3. Enable the toolbar's **Freeze Device** snowflake, then use **Save As** to keep a
   separate frozen artifact. Freeze actually occurs when saving.
4. Include required licence/attribution files with the distribution, even when
   the executable dependencies are inside the device.
5. Unload it, make development companions temporarily unavailable without deleting
   them or changing global search settings, then load the frozen artifact from a
   separate directory. Exercise actual behavior, not just its display on load.
6. Restore development files. Keep the unfrozen device and TypeScript sources as
   editable originals.

See [Cycling '74 Freeze](https://docs.cycling74.com/userguide/m4l/live_freezing/),
[Sharing](https://docs.cycling74.com/userguide/m4l/live_sharing/) and
[Ableton's production guidelines](https://github.com/Ableton/maxdevtools/blob/main/m4l-production-guidelines/m4l-production-guidelines.md).
No supported deterministic headless Freeze API was established in this work.
UI automation depends on a licensed editing session and window state, so it is
not shipped as a Node dependency or CLI flag. Frozen `mx@c` / encrypted `ciph`
parsing and encoding remain unsupported.

Native qualification on Live 12.4.6 / Max 9.1.5 (macOS): the bundled typed Live
Tempo example was packaged with its script and `LICENSE.tsln`. A qualification
copy used a unique script name to avoid collisions with existing development
examples. Max Freeze + Save As produced a 39,353-byte artifact. After unloading it
and temporarily renaming both source/distribution script copies, the frozen
artifact loaded from a separate folder and followed tempo 120 → 137 → 151 BPM.
The sources were restored. This was a reload in the running Live session, not a
fresh-process or Windows qualification. The toolkit still correctly rejects the
frozen artifact with `UNSUPPORTED_AMXD`.
