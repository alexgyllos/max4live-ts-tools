import { mkdirSync } from "node:fs";
import {
  PatchBuilder,
  writeFile,
  readFile,
  diffPatches,
  PatchEditor,
} from "../index.js";
mkdirSync("examples/generated", { recursive: true });
const patch = new PatchBuilder({
  rect: [0, 0, 600, 400],
  metadata: { fileversion: 1, classnamespace: "box" },
})
  .add("loadbang", { id: "start", at: [20, 20] })
  .add("message", { id: "greeting", text: "Hello from Max", at: [20, 60] })
  .add("print", { id: "output", varname: "output", at: [20, 100] })
  .connect(["start", 0], ["greeting", 0])
  .connect(["greeting", 0], ["output", 0])
  .toNormalized();
writeFile("examples/generated/created.maxpat", patch);
const editor = PatchEditor.fromNormalized(
  readFile("examples/generated/created.maxpat"),
);
editor.validateOrThrow();
const changed = editor.updateBox("output", {
  passthrough: { text: "print revised" },
});
changed.write("examples/generated/edited.maxpat");
console.log(diffPatches(patch, changed.toNormalized()));
