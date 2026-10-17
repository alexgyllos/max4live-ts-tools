# Community introduction drafts

Unsent drafts for use after v0.3.0 is published and the links resolve on main.
Verify the registry version and attach the actual demo/device downloads first.

## Cycling '74 community

I've been building [max4live-ts-tools](https://github.com/alexgyllos/max4live-ts-tools),
a TypeScript toolkit for creating, editing and validating Max patches and Max for
Live devices. TypeScript constructs the patch offline; the generated device uses
real Max objects and can be opened in Max as usual. It also discovers static
external dependencies and packages unfrozen devices with their companion files.

[Simple Chorus](https://github.com/alexgyllos/max4live-ts-tools/tree/main/examples/simple-chorus)
is a working example: stereo chorus, native Rate/Depth/Mix controls and a stationary
LFO preview. You can try its prebuilt device or build it from the TypeScript source.

The library is on [npm](https://www.npmjs.com/package/max4live-ts-tools).
I'd welcome feedback on device compatibility and the construction/editing API.
The examples were tested in Live 12.4.6 / Max 9.1.5; frozen/encrypted device editing
is unsupported, and static discovery can't identify every runtime dependency.

## tsln-lab/max-packages maintainers

Hi! [max4live-ts-tools](https://github.com/alexgyllos/max4live-ts-tools) builds on
`@tsln/amxd` for its supported binary containers. It adds offline patch/device
construction, validation, editing and companion-file packaging, complementing
your TypeScript runtime packages.

The [Live Tempo workflow](https://github.com/alexgyllos/max4live-ts-tools/tree/main/examples/live-tempo)
uses your Max/LOM types and `@tsln/live-object`, follows the `create-max` build
conventions, and packages the generated device with its compiled script and MIT
notices. [Simple Chorus](https://github.com/alexgyllos/max4live-ts-tools/tree/main/examples/simple-chorus)
shows the offline-only approach with standard Max objects.

I'd be interested in shared rights-cleared native fixtures and binary round-trip
compatibility checks. There's a small [ordered-container API proposal](https://github.com/alexgyllos/max4live-ts-tools/blob/main/docs/tsln-amxd-proposal.md)
that could simplify our preservation adapter while keeping your existing APIs
unchanged. Thanks for making these packages available.
