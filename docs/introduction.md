# Community introduction drafts

Drafts only; no announcements or maintainer contact have been sent. Attach
`examples/stereo-gain/Stereo Gain.amxd` and use the example's build instructions.
Send after the example/documentation PRs are merged so the source links resolve.

## Cycling '74 / TypeScript developer community

I've been building **max4live-ts-tools**: create, edit, validate and generate Max
for Live devices programmatically using TypeScript.

TypeScript runs offline to construct the patch; it doesn't need to run inside
Max. The Stereo Gain example generates a normal audio effect with independent
stereo paths, a registered Gain parameter, 10 ms smoothing, automation and saved
state. It uses built-in Max objects and no companion JavaScript. It's been tested
in Live 12.4.6 / Max 9.1.5, including captured audio levels and saved automation.

Try the attached device or build it yourself:
[Stereo Gain source and instructions](https://github.com/alexgyllos/max4live-ts-tools/tree/main/examples/stereo-gain).
The library is on [npm](https://www.npmjs.com/package/max4live-ts-tools).
I'd welcome reports about real device compatibility, API friction and workflows
that are still awkward. Frozen/encrypted device editing remains unsupported;
dependency packaging is separate work under review for a later release.

## tsln-lab/max-packages maintainers

Hi! I've been developing
[max4live-ts-tools](https://github.com/alexgyllos/max4live-ts-tools), an offline
TypeScript toolkit for building, editing, validating and comparing Max patchers
and Max for Live devices. Our supported `.amxd` codec builds on your
`@tsln/amxd`; it doesn't replace your runtime libraries.

[Stereo Gain](https://github.com/alexgyllos/max4live-ts-tools/tree/main/examples/stereo-gain)
shows offline generation using standard Max objects. Our
[Live Tempo example](https://github.com/alexgyllos/max4live-ts-tools/tree/main/examples/live-tempo)
shows the complementary workflow: `@tsln/max-types`, `@tsln/lom-types` and
`@tsln/live-object` for code that runs inside Max, bundled beside an offline-built
device. The two projects serve different parts of the same development process.

Potential collaboration could include shared rights-cleared container fixtures,
round-trip interoperability checks, and dependency metadata conventions. I'd be
interested in feedback on the boundary between offline device construction and
your typed Max runtime tools. Thanks for making those packages available.
