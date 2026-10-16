import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { readAmxd, encodeAmxd, validateGraph } from "max4live-ts-tools";

const cli = "node_modules/max4live-ts-tools/dist/cli/index.js";
const run = (...args) =>
  spawnSync(process.execPath, args, { encoding: "utf8" });
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
test("public builder is deterministic and preserves stereo/init wiring", () => {
  const before = readFileSync("js/Live Tempo.amxd");
  const result = run(".build/generate-device.mjs");
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readFileSync("js/Live Tempo.amxd"), before);
  const device = readAmxd("js/Live Tempo.amxd");
  assert(validateGraph(device.patch).ok);
  assert.deepEqual(encodeAmxd(device), new Uint8Array(before));
  for (const [sourceId, sourceOutlet, destId, destInlet] of [
    ["input", 0, "output", 0],
    ["input", 1, "output", 1],
    ["ready", 0, "script", 0],
    ["script", 0, "tempo", 0],
  ])
    assert(
      device.patch.lines.some(
        (l) =>
          l.sourceId === sourceId &&
          l.sourceOutlet === sourceOutlet &&
          l.destId === destId &&
          l.destInlet === destInlet,
      ),
    );
  assert.equal(
    device.patch.boxes.get("script").passthrough.text,
    "v8 device.js",
  );
  assert(!before.includes(Buffer.from(process.cwd())));
});
test("bundled Max handlers remain top-level and own one observer", () => {
  const result = run("test/runtime.mjs");
  assert.equal(result.status, 0, result.stderr);
});
test("CLI discovers, packages and verifies every companion-file hash in isolation", () => {
  const dependencies = run(cli, "deps", "js/Live Tempo.amxd", "--json");
  assert.equal(dependencies.status, 0, dependencies.stderr);
  const report = JSON.parse(dependencies.stdout);
  assert(
    report.dependencies.some(
      (d) => d.reference === "device.js" && d.status === "resolved",
    ),
  );
  const manifest = JSON.parse(
    readFileSync("release/Live Tempo/maxpat-package.json", "utf8"),
  );
  assert.equal(manifest.format, "unfrozen-companion-files");
  assert.deepEqual(
    manifest.files.map((f) => f.path).sort((a, b) => a.localeCompare(b, "en")),
    ["LICENSE", "LICENSE.tsln", "Live Tempo.amxd", "device.js"].sort((a, b) =>
      a.localeCompare(b, "en"),
    ),
  );
  for (const f of manifest.files) {
    const bytes = readFileSync(`release/Live Tempo/${f.path}`);
    assert.equal(f.size, bytes.length);
    assert.equal(f.sha256, hash(bytes));
  }
  assert.match(
    readFileSync("release/Live Tempo/LICENSE.tsln", "utf8"),
    /Mateo Murphy/,
  );
  renameSync("js", ".development-unavailable");
  try {
    const isolated = run(
      cli,
      "deps",
      "release/Live Tempo/Live Tempo.amxd",
      "--json",
    );
    assert.equal(isolated.status, 0, isolated.stderr);
    const missing = run(
      cli,
      "deps",
      ".development-unavailable/Live Tempo.amxd",
      "--json",
    );
    assert.equal(missing.status, 0, missing.stderr); // the moved development set remains internally valid
    assert.equal(
      readAmxd("release/Live Tempo/Live Tempo.amxd").patch.boxes.get("script")
        .passthrough.text,
      "v8 device.js",
    );
  } finally {
    renameSync(".development-unavailable", "js");
  }
  renameSync("js/device.js", "js/device.unavailable");
  try {
    assert.equal(run(cli, "deps", "js/Live Tempo.amxd", "--json").status, 1);
  } finally {
    renameSync("js/device.unavailable", "js/device.js");
  }
});

test(
  "upstream esbuild watching rebuilds runtime and Node device sources",
  { timeout: 20000 },
  async () => {
    const runtimeSource = readFileSync("src/device.ts", "utf8");
    const deviceSource = readFileSync("build/generate-device.ts", "utf8");
    const child = spawn(process.execPath, ["build.mjs", "--watch"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let log = "";
    child.stdout.on("data", (bytes) => {
      log += bytes;
    });
    child.stderr.on("data", (bytes) => {
      log += bytes;
    });
    const closed = new Promise((resolve) => child.once("close", resolve));
    const until = (predicate) =>
      new Promise((resolve, reject) => {
        const end = Date.now() + 8000;
        const timer = setInterval(() => {
          try {
            if (predicate()) {
              clearInterval(timer);
              resolve();
            } else assert(child.exitCode === null && Date.now() < end, log);
          } catch (error) {
            clearInterval(timer);
            reject(error);
          }
        }, 50);
      });
    try {
      await until(() => log.includes("build finished"));
      writeFileSync(
        "src/device.ts",
        runtimeSource +
          "\nfunction workflow_watch_probe() { outlet(0, 987); }\n",
      );
      await until(() =>
        readFileSync("js/device.js", "utf8").includes("workflow_watch_probe"),
      );
      writeFileSync(
        "build/generate-device.ts",
        deviceSource.replace('name: "Live Tempo"', 'name: "Watched Tempo"'),
      );
      await until(
        () =>
          readAmxd("js/Live Tempo.amxd").patch.patcherMeta.passthrough.title ===
          "Watched Tempo",
      );
    } finally {
      child.kill();
      await closed;
      writeFileSync("src/device.ts", runtimeSource);
      writeFileSync("build/generate-device.ts", deviceSource);
      const rebuilt = run("build.mjs");
      assert.equal(rebuilt.status, 0, rebuilt.stderr);
    }
  },
);
