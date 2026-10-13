# Security

The 0.1.0 release candidate is unpublished; no released versions currently have support guarantees. Latest supported release policy will be established at publication.

Do not post secrets or exploitable patch files to public issues. Use the repository's private vulnerability-reporting interface if the owner enables it. Otherwise request a private report channel from the owner through your existing contact; no unverified security email is advertised. Private reporting/integration enablement is an owner release gate.

Report affected version, minimal authorized/synthetic fixture, expected/actual behavior, impact and environment. The owner triages best-effort; no response SLA is claimed. Never include proprietary devices or access tokens. Before package publication and after source changes, run dependency audit and the full-history scanner, then review ownership and third-party rights. A zero-pattern scan is evidence about the searched patterns, not proof of no secrets.

Input is bounded finite JSON; graphs cannot refer to missing ports/boxes on normal output. Structural validation cannot be disabled. Filesystem writes require trusted parent directories; no hostile-parent, crash durability, external bpatcher loading or sandbox guarantee is provided. Back up valuable files. See docs/baseline.md and docs/api-contract.md.
