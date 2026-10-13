import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  parsePatchObject,
  diffPatches,
  serializePatch,
  parsePatch,
} from "../core.js";
import { runCli } from "../cli/run.js";
const raw = () =>
  JSON.parse(
    readFileSync(new URL("./fixtures/nested.maxpat", import.meta.url), "utf8"),
  );
it("diff sees object content, metadata, rewiring and nested changes", () => {
  const a = raw();
  const p = parsePatchObject(a);
  expect(diffPatches(p, parsePatch(serializePatch(p))).equal).toBe(true);
  const edits = [
    (r: ReturnType<typeof raw>) => (r.patcher.boxes[0].box.text = "changed"),
    (r: ReturnType<typeof raw>) => r.root_extension.future.push(9),
    (r: ReturnType<typeof raw>) =>
      (r.patcher.lines[0].patchline.destination = ["external", 0]),
    (r: ReturnType<typeof raw>) =>
      (r.patcher.boxes[1].box.patcher.boxes[0].box.text = "nested"),
    (r: ReturnType<typeof raw>) => (r.patcher.lines[0].patchline.order = 5),
    (r: ReturnType<typeof raw>) =>
      (r.patcher.boxes[0].wrapper_extension.test = false),
    (r: ReturnType<typeof raw>) => r.patcher.boxes.reverse(),
  ];
  for (const edit of edits) {
    const b = raw();
    edit(b);
    const diff = diffPatches(p, parsePatchObject(b));
    expect(diff.equal).toBe(false);
    expect(diff.changes.length).toBeGreaterThan(0);
    expect(diffPatches(p, parsePatchObject(b))).toEqual(diff);
  }
});
it("diff reports ID changes as removed/added and escapes paths", () => {
  const a = raw(),
    b = raw();
  b.patcher.boxes[0].box.id = "with/slash~";
  const diff = diffPatches(parsePatchObject(a), parsePatchObject(b));
  expect(
    diff.changes.some((c) => c.kind === "removed" && c.path.endsWith("/obj-1")),
  ).toBe(true);
  expect(
    diff.changes.some(
      (c) => c.kind === "added" && c.path.endsWith("/with~1slash~0"),
    ),
  ).toBe(true);
});
it("diff owns output and distinguishes absent vs empty lines and negative zero", () => {
  const a = parsePatchObject({ patcher: { boxes: [] } }),
    b = parsePatchObject({ patcher: { boxes: [], lines: [] } });
  expect(diffPatches(a, b).equal).toBe(false);
  const c = diffPatches(
    parsePatchObject({ patcher: { boxes: [], value: -0 } }),
    parsePatchObject({ patcher: { boxes: [], value: 0 } }),
  );
  expect(c.equal).toBe(false);
});
it("CLI validates flags, argument counts and JSON errors consistently", () => {
  for (const args of [
    ["--json", "what"],
    ["check", "--json"],
    ["--write", "check", "file", "--json"],
    ["--json", "--unknown"],
    ["--version", "file", "--json"],
  ]) {
    let stdout = "",
      stderr = "";
    const status = runCli(args, "test", {
      stdout: (t) => (stdout += t),
      stderr: (t) => (stderr += t),
    });
    expect(status).toBe(2);
    expect(stdout).toBe("");
    expect(JSON.parse(stderr)).toMatchObject({
      schemaVersion: 1,
      ok: false,
      error: { name: "Error" },
    });
  }
});
it("unknown metadata named patcher is ordinary data, never a graph", () => {
  const a = { patcher: { boxes: [], extension: { patcher: { boxes: [1] } } } },
    b = { patcher: { boxes: [], extension: { patcher: { boxes: [2] } } } };
  expect(diffPatches(parsePatchObject(a), parsePatchObject(b)).changes).toEqual(
    [
      {
        kind: "updated",
        path: "/patcher/extension/patcher/boxes/0",
        before: 1,
        after: 2,
      },
    ],
  );
});
