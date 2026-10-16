# Typed Live Tempo device

A standalone version of the existing Live Tempo example, following the real
`@tsln/create-max` 0.1.0 scaffold: `src/*.ts` bundles into `js/*.js` using neutral
CommonJS, ES2022 and disabled tree shaking. Max handlers are deliberately not
exported. Node generation code has its own TypeScript context under `build/`.

## Use the reviewed source candidate

The manifest pins the existing registry release `max4live-ts-tools@0.2.0`. The
packaging CLI in this example requires the newer source candidate; it has not
been published. Test the example against a locally packed candidate:

```sh
# Repository root, Node 22.12+ or Node 24
npm ci
npm pack
cd examples/live-tempo
npm ci
npm install --no-save --package-lock=false ../../max4live-ts-tools-0.2.0.tgz
npm run build
npm run check
npm run package
npm test
```

`build` typechecks both environments, compiles `src/device.ts` to `js/device.js`,
and generates `js/Live Tempo.amxd` through the public toolkit API. Keeping the
device beside its script follows upstream's documented alternative to changing
Max's global search path. `package` uses `maxpat deps` and `maxpat package`, producing
`release/Live Tempo/` with the device, bundled script, licences and integrity manifest.
This is an unfrozen companion-file distribution; distribute the whole directory.

Load the development or release `.amxd` on an audio track in Live. Stereo audio
passes through; the display reads Live's current tempo and follows changes.
`live.thisdevice` starts the typed observer after initialisation. Reinitialising
or deleting the script unsubscribes the previous observer, and queued callbacks
from a previous revision are ignored. No polling, timer or console polyfill is used.

```sh
npm run watch
```

Watch uses esbuild's watcher for both runtime and Node builder dependencies.
Runtime changes rebuild `js/device.js`; device-source changes regenerate the
`.amxd`. Max's `autowatch` reloads a loaded script when available. Reopen the
`.amxd` after graph changes; automatic device hot reload is not promised. Run
`npm run typecheck` for type diagnostics while developing.

`npm test` checks runtime handlers in a Max-global test harness, observer cleanup,
stereo/init wiring, deterministic generation, discovery, package hashes and
licences, and distribution discovery with the development directory unavailable.
Those checks run on Node; native Live qualification is separate.

The build conventions are adapted from Mateo Murphy's MIT-licensed
[@tsln/create-max](https://github.com/tsln-lab/max-packages/tree/main/packages/create-max).
`LICENSE.tsln` retains the MIT notice for the adapted scaffold and bundled
`@tsln/live-object` runtime; the release includes it alongside this example’s licence.

## Native qualification

On 2026-10-16, the packaged candidate ran in Live 12.4.6 / Max 9.1.5 while the
original development `js/` directory was moved away. It read 120 BPM and followed
137/143/151 BPM changes, survived Edit in Max/save and a saved Set reopening, then
followed 127 BPM. Three additional load/delete cycles left the retained devices
working. A 48 kHz / 16-bit capture through the packaged device preserved independent
440/880 Hz stereo peaks of 0.200012/0.100006. The capture began 500 ms after device
initialisation. Observer lifetime and stale-callback suppression are also checked
with the bundled runtime harness; this is separate from the native UI evidence.
Max 9.2 was not installed, so native compatibility there is not claimed.
The Max console retained earlier unrelated qualification messages; no new typed
runtime errors appeared during these checks.
