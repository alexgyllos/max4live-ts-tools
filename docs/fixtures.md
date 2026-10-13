# Fixture matrix and provenance

The test corpus uses small JSON patchers with generic object names and authored metadata. Fixtures are test data, not certified Max exports. Redistribution approval and copyright attribution remain owner release checks. A genuine Max export must include a rights statement and verification record before it is added.

| Case                                                                            | Coverage                                                                      |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Empty / absent lines                                                            | safety tests, empty.maxpat                                                    |
| Simple graph                                                                    | small-valid.maxpat.json, examples/simple.maxpat                               |
| Unknown root/patcher/wrapper/box/line fields, saved attributes, order/midpoints | metadata.maxpat and deep round-trip tests                                     |
| Inline nested graph, local repeated IDs, external bpatcher args/name            | nested.maxpat and API tests                                                   |
| Malformed JSON/schema, dangling ports/boxes, duplicates                         | fixtures and safety/graph tests                                               |
| Atypical classes, Unicode, negative zero                                        | seeded API and serializer tests                                               |
| Large input                                                                     | deterministic 10,000-box test generated in memory                             |
| Cycles/accessors/sparse arrays/resource bounds                                  | adversarial safety tests                                                      |
| Genuine Max save/export                                                         | Pending rights-approved export and the procedure in docs/max-compatibility.md |

Never add proprietary devices, bundled audio, external scripts or third-party patch content without permission. Unsupported structures must fail clearly instead of being silently rewritten.
