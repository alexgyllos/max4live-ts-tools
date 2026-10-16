# Proposal: optional ordered raw `.amxd` chunks

Not submitted upstream. Based on [amxd source at e61dd7c](https://github.com/tsln-lab/max-packages/blob/e61dd7c1ddfc176e3d3f5e50fe48850e1085d2cf/packages/amxd/src/index.ts). No fork, codec replacement or upstream changes accompany this proposal.

## Existing overlap

`decodeRaw` (lines 128–169) already validates magic, type, chunk framing/bounds, four-byte metadata and the presence of `meta`/`ptch`. It retains unknown chunk payloads and their relative order, and exposes the patch JSON text without JSON reserialization. This already preserves whitespace and numeric spelling when using the raw API. Container version and metadata values are exposed; the meaning of `meta` remains undocumented.

`encodeRaw` (172–209) writes `meta`, then unknown chunks, then `ptch`, with exactly one terminating NUL. It preserves unknown payload bytes, but not their original positions relative to known chunks. `decodeRaw` removes all trailing NUL bytes and uses replacement decoding for invalid UTF-8. Duplicate known chunks currently use the last value. These are existing behaviours; do not change them as part of a preservation addition.

Our [adapter](../amxd/codec.ts) adds an ordered scan, strict version-4/UTF-8/known-chunk checks, resource limits and explicit `mx@c`/`ciph` unsupported-format errors. It invokes upstream encoding, then restores original chunk positions and, for semantically unchanged patchers, the original `ptch` bytes including NUL padding. Structural/graph and device-project validation belong above a general binary codec.

## Minimal additive API

Consider new low-level functions, tentatively `decodeContainer(bytes)` and `encodeContainer(container)`, exposing the validated header plus **every chunk in original order**, each with its raw payload. Unknown and repeated tags remain representable. Copy payloads so the result does not alias caller buffers. Encoding derives framing lengths from payload bytes and validates tags/header values and output size without reordering chunks or interpreting JSON.

This leaves `decodeRaw`/`encodeRaw`, JSON APIs and existing canonical output entirely unchanged. Raw `ptch` payloads preserve original UTF-8 bytes and terminators; callers replacing JSON deliberately supply new bytes. Frozen/encrypted decoding or encoding is outside the proposal. Specific unsupported-format error codes could be a separate compatible discussion, not a prerequisite.

## Evidence and adapter simplification

Use [our container tests](../__tests__/amxd.test.ts): unusual unknown chunks before `ptch` and after `meta`, repeated unknown tags, noncanonical JSON floats/whitespace, multiple NULs, typed-array byte offsets, truncation and duplicate-known-chunk rejection in the higher-level adapter. Keep rejection tests scoped to whichever API promises that policy. Add a direct ordered-API byte-identity test and prove the old canonical encoder's bytes are unchanged.

Native references include the audio/MIDI/instrument/nested Max 9.1.5 devices and [typed native device](../__tests__/fixtures/typed-native-device-max-9.1.5.amxd), all authored for this repository. Deliberately malformed/unusual containers are independently framed in tests rather than claimed as native Max output.

With an ordered API we could replace the framing scan and post-encoding reassembly, while retaining our version/resource/UTF-8/frozen policy, duplicate-known-chunk policy, schema/graph/project validation and semantic comparison deciding whether to reuse the original JSON payload. This is a bounded interoperability improvement, not justification for rewriting the working adapter now.
