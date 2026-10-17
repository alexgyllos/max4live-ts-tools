# Contributing

Use Node 24:

```sh
npm ci
npm run verify
```

`npm run build` compiles the package with native TypeScript 7.
`npm run format` applies Oxfmt formatting. Verification checks formatting,
types, unused code, tests, examples and an installed tarball consumer.
CI runs the same checks on Linux, macOS and Windows with Node 22 and 24.

Open a focused pull request with a short explanation and relevant test results.
Add regression coverage for fixes and update the README or examples when usage
changes. Keep tests self-contained with synthetic fixtures or patches you have
permission to distribute. Preserve unknown patch metadata and immutable editor
revisions.

Use GitHub issues for reproducible bugs and feature requests.

## Build the examples from source

The example manifests pin the published 0.2.0 baseline. Native presentation and
packaging need 0.3.0, which is being prepared for release. Until publication,
install the locally packed toolkit into the example; no repository-private imports
or global linking are needed:

```sh
# Repository root, Node 22.12+ within Node 22, or Node 24
npm ci
npm pack
cd examples/simple-chorus # or stereo-gain, or live-tempo
npm ci
npm install --no-save --package-lock=false ../../max4live-ts-tools-0.3.0.tgz
npm test
```

`npm test` builds the device and checks its output. For Live Tempo it also packages
the compiled script and licences. Root `npm run verify` tests all three examples in
isolated directories against the packed candidate. After publication, the example
pins and locks can move to 0.3.0 and use `npm ci` directly.
