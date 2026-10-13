import { mkdirSync } from "node:fs";
import { readFile, writeFile, PatchEditor, diffPatches } from "../index.js";
import {
  queryPatch,
  serializePatch,
  parsePatch,
  type CustomRule,
} from "../core.js";
mkdirSync("examples/generated", { recursive: true });
const patch = readFile("__tests__/fixtures/nested.maxpat");
const custom: CustomRule = {
  code: "EXAMPLE_TEXT",
  check: (p) =>
    [...p.boxes.values()]
      .filter((b) => b.maxclass === "newobj" && !b.passthrough.text)
      .map((b) => ({
        severity: "warning",
        code: "EXAMPLE_TEXT",
        message: "Object has no text",
        location: { boxId: b.id },
      })),
};
const editor = PatchEditor.fromNormalized(patch);
console.log(editor.validate({ I001: "off" }, [custom]));
console.log(queryPatch(patch, { text: "print", match: "partial" }));
const changed = editor.editAtPath(["obj-2"], (child) =>
  child.updateBox("obj-2", { passthrough: { text: "print nested" } }),
);
const text = serializePatch(changed.toNormalized());
const inMemory = parsePatch(text, { validateGraph: true });
writeFile("examples/generated/nested-edited.maxpat", inMemory);
console.log(diffPatches(patch, inMemory));
