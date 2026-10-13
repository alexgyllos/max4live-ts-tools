import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
const npmPath = process.env.npm_execpath;
if (!npmPath) throw new Error("Run using npm run pack:check");
const temp = mkdtempSync(join(tmpdir(), "maxpat-consumer-"));
const npm = (args, cwd) =>
  spawnSync(process.execPath, [npmPath, ...args], { cwd, encoding: "utf8" });
function requireSuccess(result) {
  assert.equal(result.status, 0, result.stderr + result.stdout);
  return result.stdout;
}
let verificationError;
try {
  const pack = JSON.parse(
    requireSuccess(
      npm(["pack", "--json", "--pack-destination", temp], process.cwd()),
    ),
  )[0];
  assert(pack.files.some((f) => f.path === "dist/index.d.ts"));
  assert(
    pack.files.every(
      (f) =>
        f.path === "package.json" ||
        f.path.startsWith("dist/") ||
        ["README.md", "CHANGELOG.md", "LICENSE"].includes(f.path),
    ),
  );
  assert(
    !pack.files.some((f) =>
      /(__tests__|node_modules|\.env|\.maxpat|scripts\/)/.test(f.path),
    ),
  );
  const consumer = join(temp, "consumer");
  mkdirSync(consumer);
  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify({ private: true, type: "module" }),
  );
  requireSuccess(
    npm(
      [
        "install",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        join(temp, pack.filename),
      ],
      consumer,
    ),
  );
  const lib = join(consumer, "node_modules", "max4live-ts-tools");
  // Check the installed README, rather than assuming repository-relative links
  // are available in the tarball. Repository links must name existing sources.
  const readme = readFileSync(join(lib, "README.md"), "utf8");
  const repositoryDocs =
    "https://github.com/alexgyllos/max4live-ts-tools/blob/main/";
  const packedPaths = new Set(pack.files.map((file) => file.path));
  for (const [, target] of readme.matchAll(/\]\(([^)]+)\)/g)) {
    if (target.startsWith(repositoryDocs)) {
      readFileSync(resolve(target.slice(repositoryDocs.length).split("#")[0]));
    } else if (!/^https?:\/\//.test(target) && !target.startsWith("#")) {
      assert(
        packedPaths.has(target.split("#")[0]),
        `Unshipped README link: ${target}`,
      );
    }
  }
  const smoke = `import assert from 'node:assert/strict';
 import {PatchBuilder,parsePatch,serializePatch,diffPatches} from 'max4live-ts-tools/core';
 import {readFile,writeFile,PatchEditor} from 'max4live-ts-tools';
 const patch=new PatchBuilder().object({id:'a',text:'loadbang',numinlets:0,numoutlets:1}).object({id:'b',text:'print example',numinlets:1,numoutlets:0}).connect(['a',0],['b',0]).toNormalized();
 writeFile('created.maxpat',patch);assert(diffPatches(patch,readFile('created.maxpat')).equal);assert.equal(PatchEditor.fromFile('created.maxpat').findById('a').id,'a');assert(diffPatches(patch,parsePatch(serializePatch(patch))).equal);
 const inserted=JSON.parse(serializePatch(patch));inserted.patcher.lines.unshift({patchline:{source:['a',0],destination:['b',0],order:5}});const changes=diffPatches(patch,parsePatch(JSON.stringify(inserted))).changes;assert.equal(changes.length,1);assert.equal(changes[0].kind,'added');assert.equal(changes[0].path,'/patcher/lines/0');`;
  writeFileSync(join(consumer, "smoke.mjs"), smoke);
  requireSuccess(
    spawnSync(process.execPath, ["smoke.mjs"], {
      cwd: consumer,
      encoding: "utf8",
    }),
  );
  // Namespace imports load both complete public declaration graphs. The native
  // compiler checks declaration internals without needing the legacy JS API.
  const declarations = [
    join(lib, "dist/index.d.ts"),
    join(lib, "dist/core.d.ts"),
  ];
  const imports = `import * as Root from 'max4live-ts-tools';\nimport * as Core from 'max4live-ts-tools/core';\n`;
  writeFileSync(
    join(consumer, "types.ts"),
    imports +
      `import {PatchEditor,PatchBuilder,parsePatchObject,type NormalizedPatch,type PatchDiff,diffPatches} from 'max4live-ts-tools';import {walkPatch} from 'max4live-ts-tools/core';const p:NormalizedPatch=parsePatchObject({patcher:{boxes:[]}});const d:PatchDiff=diffPatches(p,p);const e=PatchEditor.fromNormalized(p);new PatchBuilder();walkPatch(e.toNormalized());console.log(Root,Core,d);`,
  );
  const compileTypes = () =>
    spawnSync(
      process.execPath,
      [
        resolve("node_modules/typescript/bin/tsc"),
        "--noEmit",
        "--strict",
        "--skipLibCheck",
        "false",
        "--target",
        "ES2022",
        "--module",
        "NodeNext",
        "--moduleResolution",
        "NodeNext",
        "types.ts",
      ],
      { cwd: consumer, encoding: "utf8" },
    );
  requireSuccess(compileTypes());
  // Negative controls prove that even an unused type-only export in either
  // entrypoint is checked; a compiler that skips declarations must fail here.
  for (const declaration of declarations) {
    const original = readFileSync(declaration, "utf8");
    try {
      writeFileSync(
        declaration,
        original + "\nexport type __PackCheckProbe = __PackCheckMissing;\n",
      );
      const result = compileTypes();
      assert.notEqual(result.status, 0, "Damaged declaration was accepted");
      assert.match(result.stdout + result.stderr, /TS2304.*__PackCheckMissing/);
    } finally {
      writeFileSync(declaration, original);
    }
  }
  const manifest = JSON.parse(readFileSync(join(lib, "package.json"), "utf8"));
  const bin = join(lib, manifest.bin.maxpat);
  assert(readFileSync(bin, "utf8").startsWith("#!/usr/bin/env node"));
  const cli = (args) =>
    spawnSync(process.execPath, [bin, ...args], {
      cwd: consumer,
      encoding: "utf8",
    });
  const good = "created.maxpat";
  const changed = "changed patch.maxpat";
  const raw = JSON.parse(readFileSync(join(consumer, good), "utf8"));
  raw.patcher.boxes[1].box.text = "print changed";
  writeFileSync(join(consumer, changed), JSON.stringify(raw));
  const invalid = "dangling.maxpat";
  const bad = structuredClone(raw);
  bad.patcher.lines[0].patchline.destination = ["missing", 0];
  writeFileSync(join(consumer, invalid), JSON.stringify(bad));
  writeFileSync(join(consumer, "broken.maxpat"), "not JSON");
  writeFileSync(
    join(consumer, "-path.maxpat"),
    readFileSync(join(consumer, good)),
  );
  const checks = [
    [["--help"], 0, "stdout"],
    [["--version"], 0, "stdout"],
    [["validate", good], 0, "stdout"],
    [["--json", "check", good], 0, "stdout"],
    [["validate", "--json", invalid], 1, "stdout"],
    [["check", invalid, "--json"], 1, "stdout"],
    [["format", good, "--json"], 0, "stdout"],
    [["--json", "format", changed], 1, "stdout"],
    [["format", "--write", changed, "--json"], 0, "stdout"],
    [["--json", "diff", good, good], 0, "stdout"],
    [["diff", good, changed, "--json"], 1, "stdout"],
    [["check", "--", "-path.maxpat"], 0, "stdout"],
    [["--json", "format", "--write", invalid], 1, "stderr"],
    [["--json", "diff", good, "broken.maxpat"], 2, "stderr"],
    [["--json", "check", "absent.maxpat"], 2, "stderr"],
    [["--json", "unknown", good], 2, "stderr"],
    [["check", "--bad", "--json", good], 2, "stderr"],
    [["--json", "diff", good], 2, "stderr"],
    [["--json", "check", "--write", good], 2, "stderr"],
    [["--json", "check", good, good], 2, "stderr"],
  ];
  const originalBad = readFileSync(join(consumer, invalid), "utf8");
  for (const [args, exit, stream] of checks) {
    const result = cli(args);
    assert.equal(
      result.status,
      exit,
      JSON.stringify(args) + result.stderr + result.stdout,
    );
    assert.equal(result[stream === "stdout" ? "stderr" : "stdout"], "");
    if (args.includes("--json")) {
      const resultJson = JSON.parse(result[stream]);
      assert.equal(resultJson.schemaVersion, 1);
      if (stream === "stderr") {
        assert.equal(resultJson.ok, false);
        assert.equal(typeof resultJson.error.message, "string");
      } else if (resultJson.command === "format") {
        assert.equal(typeof resultJson.changed, "boolean");
        assert.equal(typeof resultJson.written, "boolean");
      } else if (resultJson.command === "diff") {
        assert.equal(resultJson.mode, "structural");
        assert.equal(typeof resultJson.equal, "boolean");
        assert(Array.isArray(resultJson.changes));
      } else if (
        resultJson.command === "check" ||
        resultJson.command === "validate"
      ) {
        assert.equal(typeof resultJson.ok, "boolean");
        assert(Array.isArray(resultJson.diagnostics));
      }
    }
  }
  assert.equal(readFileSync(join(consumer, invalid), "utf8"), originalBad);
  // Real installed bin wrappers, including Windows npm-generated .cmd, through npm exec.
  requireSuccess(
    npm(["exec", "--offline", "--", "maxpat", "--version"], consumer),
  );
  // Concurrent process writes: every winner must be a complete parseable patch.
  const writer = join(consumer, "concurrent.mjs");
  writeFileSync(
    writer,
    `import {parsePatchObject,writeFile} from 'max4live-ts-tools';const n=Number(process.argv[2]);for(let i=0;i<20;i++)writeFile('concurrent.maxpat',parsePatchObject({patcher:{boxes:[]},writer:n}));`,
  );
  const { spawn } = await import("node:child_process");
  const writers = await Promise.allSettled(
    Array.from(
      { length: 4 },
      (_, i) =>
        new Promise((res, rej) => {
          const child = spawn(process.execPath, [writer, String(i)], {
            cwd: consumer,
            stdio: ["ignore", "ignore", "pipe"],
          });
          let err = "";
          child.stderr.on("data", (x) => (err += x));
          child.on("error", rej);
          child.on("close", (code) =>
            code === 0 ? res() : rej(new Error(err)),
          );
        }),
    ),
  );
  const failures = writers
    .filter((result) => result.status === "rejected")
    .map((result) => result.reason);
  if (failures.length)
    throw new AggregateError(failures, "Concurrent packed writers failed");
  assert(
    Array.isArray(
      JSON.parse(readFileSync(join(consumer, "concurrent.maxpat"), "utf8"))
        .patcher.boxes,
    ),
  );
  const { readdirSync } = await import("node:fs");
  assert(!readdirSync(consumer).some((f) => f.startsWith(".maxpat-")));
  console.log(
    `Packed consumer verified: ${pack.filename}; imports/types, installed bin, ${checks.length} CLI cases, four concurrent writers`,
  );
} catch (error) {
  verificationError = error;
  throw error;
} finally {
  try {
    rmSync(temp, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
  } catch (error) {
    if (verificationError)
      throw new AggregateError(
        [verificationError, error],
        "Packed verification and cleanup failed",
      );
    throw error;
  }
}
