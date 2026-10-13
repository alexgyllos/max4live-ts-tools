# Release preparation and owner approval

Target stable version: **0.1.0**. Candidate: **0.1.0-rc.1**. Keep `private: true` and `license: UNLICENSED` until owner approval. The publishing template is deliberately outside `.github/workflows`; no publishing automation is enabled.

## Rehearsal

Run `npm ci` and `npm run release:check`. This runs lint/typecheck/format/tests/examples, an actual packed external consumer and `npm pack --dry-run`, then prints release notes and a report. It creates no tag, release, publication or visibility change. It verifies package preparation, not OIDC authorization/provenance or Max runtime compatibility. Add changes under CHANGELOG Unreleased; the script extracts that section as release notes.

The CI matrix uses pinned actions, no secrets and contents:read. It checks Ubuntu/macOS/Windows on Node 24, including packed command execution and concurrent writers. Require green results at the exact approved head; YAML alone is not qualification. Pull requests run one three-job matrix; branch pushes do not duplicate it. Main is verified again after integration.

## Approval checklist

- [ ] Review the exact changes and approve merge; preserve dependency order for stacked PRs.
- [ ] Verify rights to source/fixtures, copyright attribution, proposed MIT terms and dependency notices. Authorize LICENSE and licence metadata separately.
- [ ] Complete genuine export provenance and Max open/save/reopen qualification using docs/max-compatibility.md.
- [ ] Review full reachable history and the final package for secrets, unintended references and redistribution rights.
- [ ] Verify all three hosted jobs. Require the `verify / <os> / Node 24` contexts, an independent approving review, stale-review dismissal and resolved conversations. Disable branch force pushes/deletion and apply protections to administrators where supported.
- [x] Owner approved public source visibility for the current candidate.
- [ ] Separately approve public reporting integrations; verify support/security channels.
- [ ] Verify npm account/scope authority, name and 2FA policy. A registry lookup is not a package-name reservation. Bootstrap and trusted publisher configuration require owner action.
- [ ] Protect `npm-release` with owner review and prevent self-approval where supported. Verify the actual approval boundary before activating the template.
- [ ] Register the exact GitHub repository/workflow/environment as an npm trusted publisher with stage-only permission, close to the approved launch. Public provenance requires a matching public repository.
- [ ] Explicitly approve stable metadata (`0.1.0`, `private: false`, approved licence and public access), the exact release commit, tag, npm publication and GitHub release. Rehearse again first.
- [ ] Before staging/publication, verify README documentation URLs against the approved merged main tree. Packed checks verify source existence in the candidate; the URLs become available after stack integration.
- [ ] After authorized publication, verify package installation/listing, declarations/bin, tag/commit, provenance and links.

Inactive template: [publish.yml.example](release/publish.yml.example). It requires manual dispatch with the exact approved main SHA, stable/licensed metadata, LICENSE, public repository, checks and protected npm-release approval. It installs npm 11.19.1 on Node 24 and submits with `npm stage publish`; it contains no long-lived publish token and creates no GitHub tag/release automatically.

## Staged publication

Staging requires owner authorization: staging a new package creates a publicly visible placeholder. After submission, inspect the stage and approve the exact stage ID using `npm stage approve <stage-id>` with 2FA. CI never approves the stage. Stage-only trusted publisher permission prevents that publisher from directly publishing; verify the account setting before activation. Staging requires npm 11.15+ and Node 22.14+. A newly configured trusted publisher must complete its first successful publish within two days; configure it near launch and recreate it if it expires.

Official setup references: [Node release schedule](https://github.com/nodejs/Release), [npm trusted publishers](https://docs.npmjs.com/trusted-publishers/), [npm provenance](https://docs.npmjs.com/generating-provenance-statements/), [npm staged publishing](https://docs.npmjs.com/staged-publishing/).
