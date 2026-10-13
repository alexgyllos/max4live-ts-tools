# Release candidate readiness

This document covers the package itself. Release is pending owner approval and the acceptance checks below; package rehearsal never publishes anything.

| Area          | Implemented                                                                                   | Remaining verification                                                 |
| ------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| I/O           | Exclusive portable temporary files, fault cleanup, permission policy, bounded UTF-8/BOM reads | Supported operating-system matrix and Max save/reopen                  |
| Preservation  | Deep supported JSON round trips, unknown fields, ordering, duplicate rejection                | Genuine rights-approved Max exports                                    |
| Editor        | Owned public snapshots, immutable revisions, strict arguments and graph repair                | Max interpretation of generated objects                                |
| Core/nesting  | Filesystem-free parsing, scoped traversal/query/edit/validation, bounded inputs               | Embedded/bpatcher Max qualification                                    |
| Builder       | Explicit ports, layout/text/varname/attributes, deterministic IDs                             | Manual Max open/save/reopen                                            |
| Diff/CLI      | ID-sensitive structural comparison, installed binary, deterministic JSON/exits                | Supported platform integration checks                                  |
| Package       | ESM JavaScript, declarations, exports/bin, allowlisted archive, external consumer tests       | Approved package name/account and release metadata                     |
| CI            | Read-only fork-safe checks for Ubuntu/macOS/Windows with Node 24                              | Green checks at the exact approved head                                |
| Documentation | API guides, examples, contributor/security/conduct/templates                                  | Approved fixture/licence provenance                                    |
| Release       | Candidate version/changelog, non-publishing rehearsal, inactive OIDC template                 | Protected publishing environment, trusted publisher and owner go/no-go |

Run `npm run release:check` and `npm run audit:history` to obtain current results. Review the actual hosted checks separately. Passing JSON/unit/consumer tests does not establish Max runtime compatibility or rights to redistribute source and fixtures. Complete the Max procedure in docs/max-compatibility.md and the approval checklist in docs/release.md before package publication.
