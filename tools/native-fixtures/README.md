# Typed native reference fixtures

Development only: `@tsln/max-types` types Max's real `Patcher`/`Maxobj` APIs. No fixture JSON is constructed in the runtime script. The offline public API creates only the small Live host. Nothing in this directory ships in the npm package, and CI never launches Max.

From a clean repository installation, run `npm ci && npm run fixtures:build`. This compiles the Max script and creates ignored `.native-fixtures/generate.js` and `Native Fixture Host.amxd`.

## Ordinary patcher

In a new Max patcher, create `[v8 /absolute/path/to/repo/.native-fixtures/generate.js generate]`. This creates a separate native patcher, configures objects and opens Max's Save dialog. Save under `.native-fixtures/` with the Max version in the filename. Alternatively omit `generate` and send the `generate` message explicitly; each message creates a new window.

Max 9.1's patcher `write` message accepts no filename. Choose the save destination in Max. Do not run this utility in a patch you want to preserve.

## Device parameter and project metadata

1. Load `.native-fixtures/Native Fixture Host.amxd` on a disposable audio track in Live. Its existing stereo connections remain intact; the script creates the reference UI and common control objects inside the host.
2. Choose **Edit in Max**, inspect the presentation and save. Reinitialising an already populated host does not create another set of objects.
3. In patching view, select and remove only `[v8 generate.js device]`, then save again. This leaves a self-contained native reference device without its development generator. Close the editor and reopen the device to inspect it.
4. Copy the native-saved `.maxpat` and `.amxd` into `__tests__/fixtures/` under **new version-specific names**, inspect their diff and run `npm run verify`. Check that there are no user paths or unwanted dependency references before committing. CI never updates goldens.

Build and verification preserve an existing host byte-for-byte. To start over, move the ignored host somewhere safe or remove it explicitly, then run `npm run fixtures:build`. Keep any native outputs you want to preserve before resetting.

## Recorded evidence

The committed `typed-native-objects-max-9.1.5.maxpat` was instantiated by this utility and saved by Max 9.1.5. `typed-native-device-max-9.1.5.amxd` was populated in Live 12.4.6 / Max 9.1.5, saved through Edit in Max, and saved again after removing the generator, then successfully reloaded with all three dials registered. Its parameter dictionary and project metadata were written by Max. Both contain only repo-specific reference content.

The tests compare common-object port counts with the earlier independent Max fixture and our builder, check presentation serialization, and require byte-identical native device round-tripping. Max normalises dial heights to 48/80/63 for the selected appearances; it omits some default attributes (including left label alignment) and stores Control Border as `themecolor.live_contrast_frame`. The background flag and native colour expression are serialized; visual inspection confirmed the separator behind the controls. A standalone patcher has no Live parameter registration dictionary; use the device route for that evidence.

Max 9.2 was unavailable. Preserve separate fixtures when checking that version. This utility uses no 9.2 console, timer or networking APIs. The presentation helper remains isolated in PR #14; these fixtures can inform it without depending on or modifying that PR.

API reference: [Patcher](https://docs.cycling74.com/apiref/js/patcher/), [upstream Max types](https://github.com/tsln-lab/max-packages/tree/main/packages/max-types).
