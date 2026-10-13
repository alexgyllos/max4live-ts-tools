# Max compatibility verification

Full compatibility is pending. Opening a synthetic patch is not sufficient evidence for runtime messages, embedded/bpatcher graphs, saved attributes, ordered patch cords or save/reopen behavior. No Max version is fully qualified yet. Binary `.amxd` manipulation is outside this package's scope.

Use a saving-enabled Max environment. Create a blank patch containing loadbang → print, a button/number/message, an embedded `p child` with local repeated IDs, an independently authored bpatcher reference, presentation layout, saved object attributes and ordered patch cords. Record authorship and redistribution permission before adding an exported fixture. Use only authorized or synthetic patches.

For each candidate Max version and supported operating system:

1. Record Max version, operating system, fixture SHA-256 and provenance.
2. Open the exported `.maxpat`. Confirm the console has no unexpected errors and classes/text/varnames, attributes, positions, ports, ordered cords and embedded graphs match.
3. Parse/serialize/write to a new file with this package. Compare deep JSON structure and structural diff; retain the original.
4. Open the canonical output in Max. Inspect parent/embedded graphs, presentation and bpatcher references. Trigger generic messages and confirm print behavior.
5. Save as a third file, close and reopen. Record Max-added/changed fields separately; confirm no missing boxes, cords or attributes.
6. Open examples/simple.maxpat and generated example output. Repeat save/reopen checks and record hashes, screenshots and results in a repository issue or verification record.
7. Add the rights-approved export as a regression fixture. Qualify a version only after this checklist succeeds; unsupported cases require explicit diagnostics and documentation.

Evidence includes versions, fixture provenance, original/canonical/resaved hashes, test commands, console/object/connection/embedded/presentation findings, save/reopen results and limitations. Do not infer runtime or licensing acceptance from package tests.
