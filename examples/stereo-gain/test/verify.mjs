import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createStereoGain, INITIAL_GAIN, RAMP_MS } from "../.build/device.js";
import {
  encodeAmxd,
  decodeAmxd,
  validateGraph,
  toPatchObject,
} from "max4live-ts-tools";

test("deterministic public-package build and supported container round-trip", () => {
  const bytes = encodeAmxd(createStereoGain());
  assert.deepEqual(bytes, encodeAmxd(createStereoGain()));
  assert.deepEqual(
    bytes,
    new Uint8Array(
      readFileSync(new URL("../dist/Stereo Gain.amxd", import.meta.url)),
    ),
  );
  assert.deepEqual(
    bytes,
    new Uint8Array(
      readFileSync(new URL("../Stereo Gain.amxd", import.meta.url)),
    ),
  );
  assert.deepEqual(encodeAmxd(decodeAmxd(bytes)), bytes);
  assert.equal(validateGraph(decodeAmxd(bytes).patch).ok, true);
});

test("registered, compact float parameter and explicit stereo signal paths", () => {
  const device = createStereoGain();
  const raw = toPatchObject(device.patch).patcher;
  assert.equal(device.type, "audio");
  assert.deepEqual(raw.parameters.gain, ["Gain", "Gain", 0]);
  assert.equal(raw.devicewidth, 100);
  assert.equal(raw.openinpresentation, 1);
  const gain = device.patch.boxes.get("gain");
  assert.equal(gain.maxclass, "live.dial");
  assert.deepEqual(gain.passthrough.presentation_rect, [20, 20, 60, 48]);
  const saved = gain.passthrough.saved_attribute_attributes.valueof;
  assert.deepEqual(saved.parameter_initial, [INITIAL_GAIN]);
  assert.equal(saved.parameter_mmax, 1);
  const routes = device.patch.lines.map(
    (l) => `${l.sourceId}:${l.sourceOutlet}>${l.destId}:${l.destInlet}`,
  );
  for (const route of [
    "input:0>left:0",
    "input:1>right:0",
    "left:0>output:0",
    "right:0>output:1",
    "ramp:0>left:1",
    "ramp:0>right:1",
  ])
    assert(routes.includes(route));
  assert(!routes.some((r) => r.startsWith("input:") && r.includes(">output:")));
  assert.equal(
    device.patch.boxes.get("ramp").passthrough.text,
    `line~ ${INITIAL_GAIN}`,
  );
  assert.equal(
    device.patch.boxes.get("ramp-list").passthrough.text,
    `pack 0. ${RAMP_MS}`,
  );
});

test("initialisation bangs restored value with zero time before enabling ramps", () => {
  const patch = createStereoGain().patch;
  const line = (from, outlet, to, inlet) =>
    patch.lines.some(
      (l) =>
        l.sourceId === from &&
        l.sourceOutlet === outlet &&
        l.destId === to &&
        l.destInlet === inlet,
    );
  assert(line("ready", 0, "initialise", 0));
  assert(line("initialise", 2, "immediate", 0));
  assert(line("immediate", 0, "ramp-list", 1));
  assert(line("initialise", 1, "gain", 0));
  assert(line("initialise", 0, "smooth", 0));
  assert(line("smooth", 0, "ramp-list", 1));
  assert.equal(patch.boxes.get("immediate").passthrough.text, "0");
  assert.equal(patch.boxes.get("smooth").passthrough.text, String(RAMP_MS));
  assert(
    ![...patch.boxes.values()].some((b) =>
      /^(js|v8|node.script)\b/.test(b.passthrough.text ?? ""),
    ),
  );
});
