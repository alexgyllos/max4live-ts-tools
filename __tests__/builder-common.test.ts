import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  PatchBuilder,
  validateGraph,
  type CommonObjectName,
  type CommonObjectOptions,
} from "../core.js";
const fixture = JSON.parse(
  readFileSync(
    new URL("./fixtures/common-objects-max-9.1.5.maxpat", import.meta.url),
    "utf8",
  ),
);
it("matches raw object defaults instantiated and saved by Max 9.1.5", () => {
  expect(fixture.patcher.appversion).toMatchObject({
    major: 9,
    minor: 1,
    revision: 5,
  });
  for (const { box } of fixture.patcher.boxes) {
    const name = box.varname as CommonObjectName;
    const options: CommonObjectOptions = {
      id: box.id,
      varname: name,
      at: box.patching_rect.slice(0, 2),
    };
    if (name === "comment" || name === "message") options.text = box.text;
    const actual = new PatchBuilder().add(name, options).toRaw().patcher
      .boxes[0].box;
    expect(actual).toEqual(box);
  }
});
it("builds the documented connected example without port declarations", () => {
  const builder = new PatchBuilder()
    .add("loadbang", { id: "start" })
    .add("message", { id: "message", text: "Hello from Max" })
    .add("print", { id: "output" })
    .connect(["start", 0], ["message", 0])
    .connect(["message", 0], ["output", 0]);
  expect(validateGraph(builder.toNormalized()).ok).toBe(true);
  expect(builder.toNormalized().boxes.get("output")).toMatchObject({
    maxclass: "newobj",
    numinlets: 1,
    numoutlets: 0,
    passthrough: { text: "print" },
  });
});
it("keeps revisions, defaults and caller attributes isolated with deterministic IDs", () => {
  const base = new PatchBuilder();
  const attributes = { hint: "greeting", custom: { a: [1] } };
  const a = base.add("message", { attributes });
  const b = base.add("message");
  expect(a.toNormalized().boxOrder).toEqual(b.toNormalized().boxOrder);
  expect(base.toNormalized().boxes.size).toBe(0);
  attributes.custom.a.push(2);
  const result = a.toNormalized();
  result.boxes.values().next().value!.passthrough.outlettype = ["changed"];
  expect(a.toRaw().patcher.boxes[0].box.custom).toEqual({ a: [1] });
  expect(b.toRaw().patcher.boxes[0].box.outlettype).toEqual([""]);
  expect(a.add("print").toNormalized().boxes.size).toBe(2);
  expect(a.toNormalized().boxes.size).toBe(1);
});
it("allows position, dimensions, attributes and scripting names and rejects duplicate IDs", () => {
  const builder = new PatchBuilder().add("toggle", {
    id: "t",
    at: [20, 30],
    size: [40, 50],
    varname: "enabled",
    attributes: { parameter_enable: 1, hint: "Toggle" },
  });
  expect(builder.toRaw().patcher.boxes[0].box).toMatchObject({
    patching_rect: [20, 30, 40, 50],
    varname: "enabled",
    parameter_enable: 1,
    hint: "Toggle",
  });
  expect(
    new PatchBuilder().add("print", { rect: [1, 2, 3, 4] }).toRaw().patcher
      .boxes[0].box.patching_rect,
  ).toEqual([1, 2, 3, 4]);
  expect(() => builder.add("button", { id: "t" })).toThrow();
});
it("rejects arbitrary names, text/port overrides and malformed options; generic object remains available", () => {
  const builder = new PatchBuilder();
  for (const name of ["pack", "plugin~ 1 2 3", "toString", "__proto__"])
    expect(() => builder.add(name as CommonObjectName)).toThrow(/object\(\)/);
  for (const options of [
    { numinlets: 2 },
    { maxclass: "toggle" },
    { numoutlets: 2 },
    { text: "plugin~ 1 2 3" },
    { attributes: { text: "plugin~ 1 2 3" } },
    { size: [-1, 10] },
    { at: [NaN, 0] },
    { attributes: [] },
    null,
  ])
    expect(() =>
      builder.add("plugin~", options as unknown as CommonObjectOptions),
    ).toThrow();
  expect(
    builder
      .object({ text: "pack 0 0 0", numinlets: 3, numoutlets: 1 })
      .toNormalized().boxes.size,
  ).toBe(1);
});
