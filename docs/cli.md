# CLI and diff protocol

Installed executable: `maxpat`. `--help`/`--version` support `--json`. Flags may appear before/after command or file names. `--` protects file names beginning with `-`; quote paths containing spaces. Unknown flags/commands and extra/missing arguments fail with exit 2. `--write` is only valid for format.

| Command          | 0                                        | 1                                    | 2                                          |
| ---------------- | ---------------------------------------- | ------------------------------------ | ------------------------------------------ |
| validate / check | No error diagnostics                     | Invalid graph                        | Invocation / JSON / structural / IO error  |
| format           | Already formatted, or successful --write | Formatting differs, or graph invalid | Invocation / parse / structural / IO error |
| diff             | Structurally equal                       | Different                            | Invocation / parse / structural / IO error |

`validate` and `check` are aliases. Diagnostics (including errors) for a successfully parsed validation run go to stdout. Invocation/parse/IO exceptions go to stderr. Every `--json` response is one JSON document with `schemaVersion: 1` and a trailing newline; human output contains diagnostic codes and locations. JSON structure is described in [cli.schema.json](cli.schema.json). No run writes both streams on success or known failure.

Format dry runs never open a temp file. Apply uses the safe writer and requires a valid graph; duplicate IDs cannot be formatted. BOM is accepted for reading but canonical output removes it. Structural-invalid files cannot be formatted by bypassing graph checks.

Diff equality is **ID-sensitive structural equality**, including field presence, all metadata, wrapper fields, unknown fields, nested graphs, numeric values and array order. Object key order/whitespace are ignored. Connections match by their complete wrapper content first, then by source/destination endpoints; unmatched duplicate occurrences pair in occurrence order. Metadata edits on matched endpoints update their own paths. A rewire removes the old cord and adds the new cord. Insertions/deletions report only unmatched occurrences, retaining duplicate multiplicity. Added/updated line paths use the new array index; removed paths use the original index. Relative reordering of matched cords appears at `lineOrder`, whose before/after arrays identify their original indices; insertion/deletion shifts alone do not count as reordering. Identical duplicate cords are indistinguishable. Box additions/removals are keyed by ID and array ordering changes appear at `boxOrder`. These are descriptive paths over the diff model (IDs replace box indices), not an RFC 6902 patch you can apply directly. `~` and `/` in path segments are escaped as `~0`/`~1`. Changes sort lexicographically by path with stable same-path order. No DSP/runtime or ID-insensitive equivalence claim is made.

`diff` can inspect structurally valid graphs containing dangling endpoints; it does not treat them as valid. Validate them separately. Each `changes` record has kind/path and an optional before/after value; absent fields denote additions/removals, JSON null denotes a present null. JSON numeric `-0` is preserved in machine output.

Examples:

```sh
maxpat check --json "input patch.maxpat"
maxpat --json format "input patch.maxpat"
maxpat format --write "input patch.maxpat"
maxpat diff --json before.maxpat after.maxpat
maxpat check -- -leading-dash.maxpat
```
