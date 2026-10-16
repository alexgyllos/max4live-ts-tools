import { copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  createMaxForLiveDevice,
  PatchEditor,
  writeAmxd,
  type Rect,
} from "max4live-ts-tools";

const out = new URL("../js/", import.meta.url);
mkdirSync(out, { recursive: true });
copyFileSync(new URL("../LICENSE", import.meta.url), new URL("LICENSE", out));
copyFileSync(
  new URL("../LICENSE.tsln", import.meta.url),
  new URL("LICENSE.tsln", out),
);
const device = createMaxForLiveDevice({ type: "audio", name: "Live Tempo" });
let editor = PatchEditor.fromNormalized(device.patch);
const objects: [
  string,
  string | undefined,
  string,
  number,
  number,
  Rect,
  Record<string, unknown>,
][] = [
  ["ready", "live.thisdevice", "newobj", 1, 3, [220, 30, 100, 22], {}],
  ["script", "v8 device.js", "newobj", 1, 1, [220, 80, 100, 22], {}],
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
];
for (const [id, text, maxclass, numinlets, numoutlets, rect, attrs] of objects)
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
writeAmxd(fileURLToPath(new URL("../js/Live Tempo.amxd", import.meta.url)), {
  ...device,
  patch: editor.toNormalized(),
});
