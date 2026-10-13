# Safety contracts

Supported patch data preserves deep JSON structure, array order, scope-local IDs, unknown fields and absent lines. Canonicalization changes whitespace and object key order. Duplicate IDs are rejected before normalization; skipping graph rules never bypasses structural safety. Values must be finite, plain, acyclic, bounded JSON. Embedded patchers are graphs; external bpatcher references remain external.

Writes use an exclusive unpredictable same-directory temporary file, close it and replace the destination by rename. Pre-rename failures preserve the original. New files use mode 0600; existing POSIX rwx permission bits are preserved and special bits are dropped. Windows ACL inheritance applies. Existing symlink/nonregular destinations are rejected on inspection. Rename replaces the directory entry and does not follow a destination symlink. Parent directories must be trusted and stable; the path-based API cannot protect against an attacker replacing them.

Concurrent writers are last-successful-rename wins. There are no locks, compare-and-swap, ACL/xattr preservation or crash/power-loss durability guarantees. No fsync guarantee is claimed. OS cleanup failures are reported as causes or AggregateError instead of warnings. Back up valuable patches before editing.
