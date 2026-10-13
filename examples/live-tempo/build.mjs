import { build } from "esbuild";
import { mkdirSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  createMaxForLiveDevice,
  PatchEditor,
  writeAmxd,
} from "../../dist/index.js";
const out = new URL("../generated/live-tempo/", import.meta.url);
mkdirSync(out, { recursive: true });
// Follow @tsln/create-max's neutral CommonJS bundling and retain Max handlers.
await build({
  entryPoints: [fileURLToPath(new URL("tempo.ts", import.meta.url))],
  outfile: fileURLToPath(new URL("tempo.js", out)),
  bundle: true,
  format: "cjs",
  platform: "neutral",
  mainFields: ["main", "module"],
  conditions: ["browser"],
  target: "es2022",
  treeShaking: false,
  legalComments: "eof",
});
copyFileSync(
  new URL("../../node_modules/@tsln/live-object/LICENSE", import.meta.url),
  new URL("LICENSE.tsln", out),
);
const device = createMaxForLiveDevice({ type: "audio", name: "Live Tempo" });
let editor = PatchEditor.fromNormalized(device.patch);
for (const [id, text, maxclass, numinlets, numoutlets, rect, attrs] of [
  ["ready", "live.thisdevice", "newobj", 1, 3, [220, 30, 100, 22], {}],
  ["script", "v8 tempo.js", "newobj", 1, 1, [220, 80, 100, 22], {}],
  [
    "tempo",
    undefined,
    "flonum",
    1,
    2,
    [220, 130, 100, 22],
    {
      presentation: 1,
      presentation_rect: [20, 40, 100, 22],
      parameter_enable: 0,
    },
  ],
  [
    "label",
    "Live tempo (BPM)",
    "comment",
    1,
    0,
    [220, 180, 140, 22],
    { presentation: 1, presentation_rect: [20, 10, 140, 22] },
  ],
])
  editor = editor.addBox(
    {
      maxclass,
      numinlets,
      numoutlets,
      patchingRect: rect,
      passthrough: { ...attrs, ...(text === undefined ? {} : { text }) },
    },
    id,
  );
editor = editor
  .connect(["ready", 0], ["script", 0])
  .connect(["script", 0], ["tempo", 0]);
writeAmxd(fileURLToPath(new URL("Live Tempo.amxd", out)), {
  ...device,
  patch: editor.toNormalized(),
});
console.log(
  "Created examples/generated/live-tempo/Live Tempo.amxd and tempo.js; keep both files together.",
);
