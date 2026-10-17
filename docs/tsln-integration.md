# TypeScript to a packaged Max for Live device

Use [Live Tempo](../examples/live-tempo/README.md) as the complete reference: typed runtime code plus an offline public-API device builder, compiled and packaged through npm scripts. The upstream scaffolder supplies TypeScript-to-Max conventions; it does not generate our `.amxd` graph or packaging integration automatically.

Follow the example's [source build instructions](../CONTRIBUTING.md#build-the-examples-from-source) before running:

```sh
npm run build    # typecheck both environments, compile JS, generate .amxd
npm run check    # validate graph and discover dependencies
npm run package  # actual maxpat companion-file packaging
npm run watch    # esbuild watches runtime and builder dependencies
```

The example pins the published 0.2.0 baseline; packaging needs 0.3.0, which is not
yet published. Root verification installs the locally packed candidate into an
isolated copy and exercises the public interface.

`src/device.ts` uses Max/Lom types with ES2022 only. `build/generate-device.ts` uses a separate Node context and imports from `max4live-ts-tools`, never repository internals. The runtime bundle follows upstream's neutral CommonJS settings, `browser` condition and disabled tree shaking. Its message handlers stay unexported at top level. `live.thisdevice` triggers initialisation; the upstream observer handle is unsubscribed on reinitialisation/deletion, and a revision guard drops old queued callbacks. No timer, polling or LiveAPI wrapper is reimplemented.

The builder writes `js/Live Tempo.amxd` beside `js/device.js`, avoiding a global Max search-path change. CLI discovery finds the script; packaging produces `release/Live Tempo/`, including licences and a hash manifest. Distribute that entire directory. Watch rebuilds source artifacts; reopen the device after graph changes. Automatic `.amxd` hot reload and frozen encoding are not provided.

## Upstream audit and scaffold reproduction

Reviewed all eight package implementations and public documentation at upstream commit [`e61dd7c1ddfc176e3d3f5e50fe48850e1085d2cf`](https://github.com/tsln-lab/max-packages/tree/e61dd7c1ddfc176e3d3f5e50fe48850e1085d2cf), 2026-10-16. Versions below are that source snapshot, not a promise about future releases. The toolkit already used the codec; Live Tempo already used Max/Lom types and LiveObject. This work reorganises that example, removes its dependencies from the offline root where unnecessary, and adds only Max types to development fixture tooling.

| Package / version                                                                                                                    | Integration decision                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [amxd 0.1.0](https://github.com/tsln-lab/max-packages/tree/e61dd7c1ddfc176e3d3f5e50fe48850e1085d2cf/packages/amxd)                   | Keep as the library's binary codec dependency. Our adapter adds validation and preservation; see the focused proposal below.                                                   |
| [max-types 0.2.0](https://github.com/tsln-lab/max-packages/tree/e61dd7c1ddfc176e3d3f5e50fe48850e1085d2cf/packages/max-types)         | Max-only ambient types for the example and development fixture generator; never loaded into Node's type context.                                                               |
| [lom-types 0.1.0](https://github.com/tsln-lab/max-packages/tree/e61dd7c1ddfc176e3d3f5e50fe48850e1085d2cf/packages/lom-types)         | Example-only typed `Song.tempo` access and observer values. No duplicate LOM declarations.                                                                                     |
| [live-object 0.4.1](https://github.com/tsln-lab/max-packages/tree/e61dd7c1ddfc176e3d3f5e50fe48850e1085d2cf/packages/live-object)     | Bundle the existing public `song()`, property access, `observe()` and returned `unobserve()` handle; keep lifetime ownership in the device.                                    |
| [create-max 0.1.0](https://github.com/tsln-lab/max-packages/tree/e61dd7c1ddfc176e3d3f5e50fe48850e1085d2cf/packages/create-max)       | Reuse the real scaffold's structure/configuration and esbuild watch API through npm scripts. No supported extension API is exposed; no private imports or competing generator. |
| [console 0.1.1](https://github.com/tsln-lab/max-packages/tree/e61dd7c1ddfc176e3d3f5e50fe48850e1085d2cf/packages/console)             | Optional structured logging/`install()` for older runtimes; unnecessary for this event-driven example. Not installed.                                                          |
| [timers 0.1.2](https://github.com/tsln-lab/max-packages/tree/e61dd7c1ddfc176e3d3f5e50fe48850e1085d2cf/packages/timers)               | Optional Task-backed scheduling/`install()`; tempo already supplies events. Not installed.                                                                                     |
| [max-api-types 0.1.0](https://github.com/tsln-lab/max-packages/tree/e61dd7c1ddfc176e3d3f5e50fe48850e1085d2cf/packages/max-api-types) | Types `[node.script]` and its `max-api` module. Offline Node generation needs normal Node types, so no Node for Max integration is added.                                      |

We first ran `npm create @tsln/max@0.1.0 my-device -- --no-node`. The published 0.1.0 CLI exited successfully without generating files under npm's symlinked bin invocation: its direct-execution guard compares the bin path with the resolved module path. To inspect a genuinely generated project, the following POSIX invocation ran the same public CLI through its resolved path:

```sh
npm exec --yes --package=@tsln/create-max@0.1.0 -- sh -c \
  'node "$(realpath "$(command -v create-max)")" my-device --no-node'
cd my-device
npm install
npm run typecheck
npm run build
```

That generated and built a real project. Its registry template pinned older Max types/LiveObject ranges than the reviewed source snapshot; the integration example explicitly pins the audited package versions. We retained `src/`, `js/`, `build.mjs`, Max handler conventions and separate Node tooling, while using the repository's formatter and omitting unused console/timers and Node for Max setup. Adapted build conventions retain upstream's MIT notice.

## Native evidence and compatibility

The standalone example documents its actual Live 12.4.6 / Max 9.1.5 qualification: packaged script resolution with development files moved away, tempo changes, repeated load/delete, native save/reopen and independent stereo capture. Node tests separately check observer lifetime/stale callbacks, handler visibility, types, deterministic generation, dependencies, hashes, licences and esbuild watch rebuilds. They are not a Max emulator.

The [typed native fixture tool](../tools/native-fixtures/README.md) creates actual `Patcher`/`Maxobj` instances, saves through Max, and records version-specific presentation, parameter and project metadata. Ordinary CI compiles it and reads committed fixtures; it never requires Live or Max and never rewrites goldens.

Upstream Max types follow the Max 9.2 reference, which includes native console, timers and networking APIs. Typing an API does not make it available in Max 9.1. This example and fixture tool avoid those newer globals. Max 9.2 was unavailable for native testing; preserve separate fixtures when it becomes available. Add console/timer utilities only for a concrete older-runtime requirement, rather than overriding native 9.2 functionality.

## Codec collaboration

[The ordered raw-container proposal](tsln-amxd-proposal.md) identifies a small compatible upstream addition. It is a proposal only: upstream source and our working codec remain unchanged. Graph validation, project validation, safety limits, dependency discovery and packaging remain toolkit responsibilities. Neither frozen nor encrypted encoding is proposed.
