import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parsePatch, serializePatch } from "../core.js";
it.each([
  "empty.maxpat",
  "metadata.maxpat",
  "nested.maxpat",
  "small-valid.maxpat.json",
])("deep round trip fixture %s", (name) => {
  const text = readFileSync(
    new URL(`./fixtures/${name}`, import.meta.url),
    "utf8",
  );
  expect(JSON.parse(serializePatch(parsePatch(text)))).toEqual(
    JSON.parse(text),
  );
});
it.each([
  "duplicates.maxpat",
  "malformed-schema.maxpat",
  "malformed-json.maxpat",
])("reject fixture %s", (name) => {
  const text = readFileSync(
    new URL(`./fixtures/${name}`, import.meta.url),
    "utf8",
  );
  expect(() => parsePatch(text)).toThrow();
});
