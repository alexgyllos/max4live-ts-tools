# v0.3.0 release preparation

This is a release candidate, not a publication record. Merge approval and npm
publication approval are separate. The release PR is stacked on #17; it must not
replace the individual integration PRs.

## Integration order

Merge #14 (presentation), #15 (typed Live Tempo), #16 (native fixtures), then #17
(integration documentation), after reviewing their updated heads and checks.
Retarget each successor as its base merges and resolve any squash-merge ancestry
changes without restoring older files. Retarget the focused release PR to main
only after those changes are integrated. Verify that its resulting tree still
contains all three examples, styled creation/`--bare`, dependency discovery,
companion packaging and native fixture tooling.

The PR's six-job Linux/macOS/Windows × Node 22/24 matrix runs against the complete
candidate. Before approval it is combined-candidate evidence; final-main evidence
must come from a fresh check after the approved merges.

## Rebuild downloads

Use [the source build instructions](../CONTRIBUTING.md#build-the-examples-from-source)
for all three examples, installing the same candidate tarball into each.
`npm test` covers deterministic generation, graph checks and public-package imports.
Copy these outputs into a separate, clearly labelled staging directory:

- `examples/simple-chorus/dist/Simple Chorus.amxd`
- `examples/stereo-gain/dist/Stereo Gain.amxd`
- `examples/live-tempo/release/Live Tempo/` as `Live Tempo-v0.3.0.zip`
- The repository `LICENSE`, plus download instructions and SHA-256 checksums.

Keep the whole Live Tempo directory in the archive, including `device.js`,
`LICENSE`, `LICENSE.tsln` and `maxpat-package.json`. Never offer its `.amxd` alone.
The other two devices are self-contained. Preserve parameter registration, inspect
the package manifest/hashes, and run dependency discovery on an extracted copy
with the development directory unavailable. Exclude node_modules, temporary
outputs, qualification helpers and machine paths from the downloads.

Compare Simple Chorus and Stereo Gain with their committed bytes. Native evidence
in each example remains applicable when its runtime/builder sources and generated
device are unchanged. Repeat affected Live tests if any device output changes.
The [demo shot list](demo.md) and [community drafts](introduction.md) are prepared;
no community messages have been sent and no demo video has been recorded.

## After explicit approval

Verify a clean install, `npm run verify`, `npm pack --dry-run` and
`npm publish --dry-run --access public` on the final integrated release commit.
Inspect the tarball: only package metadata, dist, README, changelog and MIT licence
should ship. Device downloads and fixtures stay outside npm.

After an approved npm publish succeeds, tag that same commit `v0.3.0`, create the
GitHub release and attach the verified downloads. Confirm installation from the
public registry in a fresh directory and run `npx --no-install maxpat --version`.
Then update example pins/locks to 0.3.0 and remove the temporary source-install
notes from README, CONTRIBUTING and the presentation/packaging/integration guides.
Keep those changes in a focused follow-up: do not pin an unavailable registry
version in the runnable examples before publication. Post community introductions
only with separate approval.
