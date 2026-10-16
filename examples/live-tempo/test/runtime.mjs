// Development test only: load our own freshly compiled bundle, never user-provided code.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
writeFileSync(
  ".build/runtime-handlers.mjs",
  readFileSync("js/device.js", "utf8") + "\nexport { bang, notifydeleted };\n",
);
const apis = [],
  outputs = [];
let tempo = 120;
class LiveAPI {
  constructor(callback) {
    this.callback = callback;
    this.id = 1;
    this.type = "Song";
    this.property = "";
    apis.push(this);
  }
  get(name) {
    assert.equal(name, "tempo");
    return [tempo];
  }
}
const context = {
  inlets: 1,
  outlets: 1,
  autowatch: 0,
  LiveAPI,
  outlet: (port, value) => outputs.push([port, value]),
};
Object.assign(globalThis, context);
// A normal local module load executes the original bundle with only an export footer.
// Key Node globals are removed; Max-only compilation separately checks the environment.
// A CommonJS entry wrapper or external require fails here.
for (const key of [
  "process",
  "Buffer",
  "console",
  "setTimeout",
  "clearTimeout",
  "setInterval",
  "clearInterval",
  "setImmediate",
  "clearImmediate",
  "fetch",
  "File",
])
  delete globalThis[key];
const handlers = await import("../.build/runtime-handlers.mjs");
assert.equal(typeof handlers.bang, "function");
assert.equal(typeof handlers.notifydeleted, "function");
assert.equal(apis.length, 0, "No LiveAPI calls before live.thisdevice");
const active = () => apis.filter((a) => a.property === "tempo");
for (let i = 0; i < 5; i++) {
  handlers.bang();
  assert.equal(active().length, 1);
  tempo = 121 + i;
  const before = outputs.length;
  for (const api of active()) api.callback(["tempo", tempo]);
  assert.equal(outputs.length, before + 1);
  assert.deepEqual(outputs.at(-1), [0, tempo]);
}
handlers.notifydeleted();
handlers.notifydeleted();
assert.equal(active().length, 0);
const before = outputs.length;
for (const api of apis) api.callback?.(["tempo", 200]);
assert.equal(
  outputs.length,
  before,
  "Deleted observers ignore stale callbacks",
);
