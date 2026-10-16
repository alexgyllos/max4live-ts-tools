import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { encodeAmxd, decodeAmxd, validateGraph } from "max4live-ts-tools";
import {
  createSimpleChorus,
  CONTROLS,
  BASE_DELAY_MS,
  MAX_DEPTH_MS,
} from "../.build/device.js";
test("deterministic public-package build, prebuilt bytes and graph round-trip", () => {
  const d = createSimpleChorus(),
    bytes = encodeAmxd(d);
  assert.deepEqual(bytes, encodeAmxd(createSimpleChorus()));
  for (const name of ["../Simple Chorus.amxd", "../dist/Simple Chorus.amxd"])
    assert.deepEqual(
      bytes,
      new Uint8Array(readFileSync(new URL(name, import.meta.url))),
    );
  assert.deepEqual(encodeAmxd(decodeAmxd(bytes)), bytes);
  assert.equal(validateGraph(d.patch).ok, true);
  assert(
    ![...d.patch.boxes.values()].some((b) =>
      /^(js|v8|node.script)\b/.test(b.passthrough.text ?? ""),
    ),
  );
});
test("three registered controls with usable units, smoothing and recalled initialisation", () => {
  const p = createSimpleChorus().patch;
  const connects = (from, out, to, input) =>
    p.lines.some(
      (l) =>
        l.sourceId === from &&
        l.sourceOutlet === out &&
        l.destId === to &&
        l.destInlet === input,
    );
  for (const [i, c] of CONTROLS.entries()) {
    const b = p.boxes.get(c.id),
      v = b.passthrough.saved_attribute_attributes.valueof;
    assert.equal(v.parameter_unitstyle, c.unit);
    assert.deepEqual(v.parameter_initial, [c.default]);
    assert.equal(b.passthrough.appearance ?? 0, 0);
    assert.deepEqual(b.passthrough.presentation_rect, [
      24 + i * 72,
      110,
      41,
      48,
    ]);
    assert.equal(b.passthrough.saved_attribute_attributes.textcolor, undefined);
    assert.deepEqual(p.patcherMeta.passthrough.parameters[c.id], [
      c.name,
      c.name,
      0,
    ]);
    assert(connects("restore", 3 - i, c.id, 0));
    assert(connects("immediate", 0, `${c.id}-pack`, 1));
    assert(connects("smooth", 0, `${c.id}-pack`, 1));
  }
  assert(connects("restore", 4, "immediate", 0));
  assert(connects("restore", 0, "smooth", 0));
  assert(BASE_DELAY_MS - MAX_DEPTH_MS > 0);
  assert(BASE_DELAY_MS + MAX_DEPTH_MS < 50);
  assert.equal(p.boxes.get("mix-normalise").passthrough.text, "/ 100.");
  assert.equal(p.boxes.get("dry-level").passthrough.text, "!-~ 1.");
});
test("keeps left/right delay buffers separate and uses offset LFOs without feedback", () => {
  const p = createSimpleChorus().patch;
  for (const l of p.lines) {
    if (l.sourceId.startsWith("left-")) assert(!l.destId.startsWith("right-"));
    if (l.sourceId.startsWith("right-")) assert(!l.destId.startsWith("left-"));
    if (l.destId.endsWith("-buffer")) assert.equal(l.sourceId, "input");
  }
  assert.equal(p.boxes.get("right-phase").passthrough.text, "+~ 0.25");
  assert.equal(p.boxes.get("left-delay").passthrough.text, "tapout~ 15");
  assert.equal(p.boxes.get("right-delay").passthrough.text, "tapout~ 15");
});
test("native waveform display observes the actual depth-scaled LFOs without feeding audio", () => {
  const p = createSimpleChorus().patch;
  for (const name of ["left", "right"]) {
    const display = p.boxes.get(`${name}-display`);
    assert.equal(display.maxclass, "live.scope~");
    assert.equal(display.passthrough.interval, 33);
    assert.deepEqual(display.passthrough.range, [-10, 10]);
    assert(
      p.lines.some(
        (l) => l.sourceId === `${name}-depth` && l.destId === `${name}-display`,
      ),
    );
    assert(
      p.lines.some(
        (l) =>
          l.sourceId === "display-samples" && l.destId === `${name}-display`,
      ),
    );
    assert(!p.lines.some((l) => l.sourceId === `${name}-display`));
  }
  assert.equal(p.boxes.get("display-dsp").passthrough.text, "dspstate~");
  assert.equal(p.boxes.get("display-duration").passthrough.text, "* 2.");
  assert.equal(
    Object.values(p.patcherMeta.passthrough.parameters).filter(Array.isArray)
      .length,
    3,
  );
});
