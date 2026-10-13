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
  .object({
    id: "start",
    text: "loadbang",
    numinlets: 0,
    numoutlets: 1,
    at: [20, 20],
  })
  .object({
    id: "output",
    text: "print example",
    varname: "output",
    numinlets: 1,
    numoutlets: 0,
    at: [20, 80],
  })
  .connect(["start", 0], ["output", 0])
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
