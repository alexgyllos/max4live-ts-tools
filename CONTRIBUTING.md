# Contributing

Use Node 24:

```sh
npm ci
npm run verify
```

`npm run build` compiles the package with native TypeScript 7.
`npm run format` applies Oxfmt formatting. Verification checks formatting,
types, unused code, tests, examples and an installed tarball consumer.
CI runs the same checks on Linux, macOS and Windows.

Open a focused pull request with a short explanation and relevant test results.
Add regression coverage for fixes and update the README or examples when usage
changes. Keep tests self-contained with synthetic fixtures or patches you have
permission to distribute. Preserve unknown patch metadata and immutable editor
revisions.

Use GitHub issues for reproducible bugs and feature requests.
