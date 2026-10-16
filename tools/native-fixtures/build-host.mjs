// A development-only launcher; native objects and parameter registration are added by Max.
import { fileURLToPath } from "node:url";
import {
  createMaxForLiveDevice,
  PatchEditor,
  writeAmxd,
} from "max4live-ts-tools";
const device = createMaxForLiveDevice({
  type: "audio",
  name: "Native Fixture Host",
});
const editor = PatchEditor.fromNormalized(device.patch).addBox(
  {
    maxclass: "newobj",
    numinlets: 1,
    numoutlets: 1,
    patchingRect: [24, 520, 240, 22],
    passthrough: {
      text: "v8 generate.js device",
      varname: "native_fixture_generator",
    },
  },
  "generator",
);
const destination =
  process.argv[2] ??
  fileURLToPath(
    new URL("../../.native-fixtures/Native Fixture Host.amxd", import.meta.url),
  );
try {
  writeAmxd(
    destination,
    { ...device, patch: editor.toNormalized() },
    { overwrite: false },
  );
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  console.log(
    "Preserving existing native fixture host; remove it explicitly to regenerate.",
  );
}
