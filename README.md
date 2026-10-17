# max4live-ts-tools

Build, edit and validate Max patches and Max for Live devices with TypeScript.

## Install

```sh
npm install max4live-ts-tools
```

## Quick start

```sh
npx --no-install maxpat create audio MyEffect.amxd
npx --no-install maxpat check MyEffect.amxd
npx --no-install maxpat inspect MyEffect.amxd
```

Or create a stereo passthrough device in TypeScript:

```ts
import { createMaxForLiveDevice, writeAmxd } from "max4live-ts-tools";

const device = createMaxForLiveDevice({ type: "audio", name: "My Effect" });
writeAmxd("MyEffect.amxd", device);
```

## Examples

![Simple Chorus in Ableton Live](https://raw.githubusercontent.com/alexgyllos/max4live-ts-tools/main/examples/simple-chorus/screenshot.png)

- [Simple Chorus](https://github.com/alexgyllos/max4live-ts-tools/blob/main/examples/simple-chorus/README.md) — Stereo chorus with native controls and a stationary LFO preview. [Device](https://github.com/alexgyllos/max4live-ts-tools/blob/main/examples/simple-chorus/Simple%20Chorus.amxd).
- [Stereo Gain](https://github.com/alexgyllos/max4live-ts-tools/blob/main/examples/stereo-gain/README.md) — Automatable stereo gain. [Device](https://github.com/alexgyllos/max4live-ts-tools/blob/main/examples/stereo-gain/Stereo%20Gain.amxd).
- [Live Tempo](https://github.com/alexgyllos/max4live-ts-tools/blob/main/examples/live-tempo/README.md) — Typed LiveAPI integration; distribute the device with its compiled script.

Download a device with GitHub's **Download raw file** button and load it on an
audio track in Live. Source build instructions are in each example.

## Documentation

[API and CLI](https://github.com/alexgyllos/max4live-ts-tools/blob/main/docs/reference.md) ·
[Native presentation](https://github.com/alexgyllos/max4live-ts-tools/blob/main/docs/native-presentation.md) ·
[Packaging](https://github.com/alexgyllos/max4live-ts-tools/blob/main/docs/packaging.md) ·
[TypeScript in Max](https://github.com/alexgyllos/max4live-ts-tools/blob/main/docs/tsln-integration.md)

## Compatibility

v0.3.0 supports Node 22.12+ within Node 22, or Node 24. ESM only. Examples tested in
Live 12.4.6 / Max 9.1.5. Frozen and encrypted `.amxd` files are unsupported;
unfrozen devices may require companion files.

[Contributing](https://github.com/alexgyllos/max4live-ts-tools/blob/main/CONTRIBUTING.md) · [MIT](LICENSE)
