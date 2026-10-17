# Changelog

## 0.3.0

- Native Live presentation, dial appearances and styled CLI templates with `--bare`.
- Dependency discovery and unfrozen companion-file packaging with licence collection.
- Node 22 support alongside Node 24.
- Complete typed Live Tempo build, watch and packaging workflow, plus native fixture tooling.
- Stereo Gain and Simple Chorus devices, including a stationary LFO preview.

## 0.2.0 — 2026-10-15

- Unified CLI inspection, validation and structural diffs for `.maxpat` and supported `.amxd` files, with optional bounded container diffs.
- CLI device creation for audio, MIDI and instrument templates, including a playable sine instrument and safe refusal to overwrite existing files without `--force`.
- Immutable `PatchBuilder.add()` helpers with Max-verified defaults for common objects.
- Immutable float Live parameter registration with automatic presentation placement, verified automation and saved-Set recall in Live 12.4.6 / Max 9.1.5.
- File-only overwrite options separated from serialisation options in the TypeScript API.

## 0.1.0 — 2026-10-15

- Unfrozen Max for Live device encoding, editing, I/O templates and CLI conversion using `@tsln/amxd`.
- Typed Live tempo example using `@tsln` Max/LOM types and LiveObject.

- Parsing and serialisation preserve unknown fields, nested patchers and array order.
- Graph validation, immutable editing, builders, traversal and queries.
- Connection-aware structural diffs and a `maxpat` CLI for validation and formatting.
- Atomic file replacement with POSIX permission preservation and Windows rename retries.
- ESM root and filesystem-free core entrypoints with TypeScript declarations.
- Node 24 support, native TypeScript 7, Oxfmt and cross-platform package tests.
- MIT licence.
