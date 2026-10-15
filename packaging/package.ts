import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";
import { encodeAmxd } from "../amxd/codec.js";
import {
  parsePatchObject,
  toPatchObject,
  serializePatch,
} from "../io/parse.js";
import { inside, portable, readSafe } from "./files.js";
import { LIMITATIONS, type Discovery } from "./dependencies.js";

const hash = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const manifestName = "maxpat-package.json";
function exists(file: string): boolean {
  try {
    fs.lstatSync(file);
    return true;
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "ENOENT")
      return false;
    throw e;
  }
}
function sanitise(
  entry: Discovery["files"] extends Map<string, infer T> ? T : never,
): Buffer {
  if (!entry.patch) return entry.bytes;
  const raw = toPatchObject(entry.patch);
  function clean(patcher: typeof raw.patcher): void {
    // Max rebuilds this optional cache from the preserved relative references.
    // Keeping bootpath hints could hide missing files by resolving development copies.
    delete patcher.dependency_cache;
    if (
      patcher.project &&
      typeof patcher.project === "object" &&
      !Array.isArray(patcher.project)
    ) {
      const project = patcher.project as Record<string, unknown>;
      project.devpath = ".";
      project.searchpath = {};
    }
    for (const { box } of patcher.boxes) if (box.patcher) clean(box.patcher);
  }
  clean(raw.patcher);
  const patch = parsePatchObject(raw);
  return Buffer.from(
    entry.device
      ? encodeAmxd({ ...entry.device, patch })
      : serializePatch(patch),
  );
}
export function packagePlan(discovery: Discovery) {
  const files = [...discovery.files]
    .map(([name, entry]) => ({ path: name, bytes: sanitise(entry) }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const names = new Set<string>();
  for (const file of files) {
    if (names.has(file.path.toLowerCase()))
      throw new Error(`Case-insensitive filename collision: ${file.path}`);
    names.add(file.path.toLowerCase());
    if (file.path.toLowerCase() === manifestName)
      throw new Error(`Reserved distribution filename: ${manifestName}`);
    if (
      file.path
        .split("/")
        .some(
          (part) =>
            !part ||
            /[<>:"|?*\x00-\x1f]/.test(part) ||
            /[. ]$/.test(part) ||
            /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part),
        )
    )
      throw new Error(`Non-portable distribution filename: ${file.path}`);
  }
  // File/directory collisions must fail before any output is created.
  for (const a of files)
    for (const b of files)
      if (b.path.toLowerCase().startsWith(a.path.toLowerCase() + "/"))
        throw new Error(`File/directory collision: ${a.path}`);
  const manifest = {
    schemaVersion: 1,
    format: "unfrozen-companion-files",
    device: discovery.devicePath,
    files: files.map((f) => ({
      path: f.path,
      size: f.bytes.length,
      sha256: hash(f.bytes),
    })),
    limitations: LIMITATIONS,
  };
  return { files, manifest };
}

/** Validates all content in a sibling staging directory before claiming the output.
 * Directory publication is not atomic: failures roll back the owned output and restore a replaced directory.
 * Use stable parent directories; symlink roots, inputs, assets and outputs are rejected.
 */
export function writePackage(
  discovery: Discovery,
  output: string,
  replace = false,
) {
  if (discovery.dependencies.some((d) => d.status !== "resolved"))
    throw new Error(
      "Resolve every missing, ambiguous or dynamic dependency before packaging",
    );
  const plan = packagePlan(discovery);
  const requested = path.resolve(output);
  if (
    discovery.roots.some((root) => inside(requested, root)) ||
    [...discovery.files.values()].some((file) => inside(requested, file.source))
  )
    throw new Error("Output must not contain any source root or source file");
  const parents: string[] = [];
  function ensure(directory: string): void {
    if (fs.existsSync(directory)) {
      if (
        fs.lstatSync(directory).isSymbolicLink() ||
        !fs.statSync(directory).isDirectory()
      )
        throw new Error(
          `Expected a regular output parent directory: ${directory}`,
        );
      return;
    }
    ensure(path.dirname(directory));
    fs.mkdirSync(directory);
    parents.push(directory);
  }
  let stage: string | undefined,
    backup: string | undefined,
    lock: string | undefined;
  let claimed: fs.Stats | undefined,
    committed = false;
  let destination = requested;
  const warnings: string[] = [];
  try {
    ensure(path.dirname(requested));
    destination = path.join(
      fs.realpathSync(path.dirname(requested)),
      path.basename(requested),
    );
    // Repeat containment checks against the canonical parent, including aliases such as /tmp.
    if (
      discovery.roots.some((root) => inside(destination, root)) ||
      [...discovery.files.values()].some((file) =>
        inside(destination, file.source),
      )
    )
      throw new Error("Output overlaps source files");
    const lockPath = path.join(
      path.dirname(destination),
      `.${path.basename(destination)}.maxpat-lock`,
    );
    fs.mkdirSync(lockPath);
    lock = lockPath;
    if (exists(destination)) {
      const stat = fs.lstatSync(destination);
      if (stat.isSymbolicLink() || !stat.isDirectory())
        throw new Error(
          "Output must be a regular directory, not a file or symlink",
        );
      if (!replace)
        throw new Error(
          "Output already exists; use --force to replace the directory",
        );
    }
    stage = fs.mkdtempSync(
      path.join(path.dirname(destination), ".maxpat-package-"),
    );
    for (const file of plan.files) {
      const target = path.join(stage, file.path);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, file.bytes, { flag: "wx", mode: 0o644 });
    }
    fs.writeFileSync(
      path.join(stage, manifestName),
      JSON.stringify(plan.manifest, null, 2) + "\n",
      { flag: "wx", mode: 0o644 },
    );
    for (const file of plan.files) {
      const bytes = readSafe(path.join(stage, file.path), [stage]);
      if (hash(bytes) !== hash(file.bytes))
        throw new Error(`Staged file verification failed: ${file.path}`);
    }
    if (exists(destination)) {
      // The lock serialises this command's writers; recheck immediately before replacement.
      if (
        !replace ||
        fs.lstatSync(destination).isSymbolicLink() ||
        !fs.lstatSync(destination).isDirectory()
      )
        throw new Error("Output changed while staging; refusing replacement");
      backup = fs.mkdtempSync(
        path.join(path.dirname(destination), ".maxpat-previous-"),
      );
      fs.renameSync(destination, path.join(backup, "previous"));
    }
    // mkdir is an exclusive claim, so a concurrent creator cannot be overwritten by rename.
    fs.mkdirSync(destination);
    claimed = fs.lstatSync(destination);
    for (const name of fs
      .readdirSync(stage)
      .filter((name) => name !== manifestName))
      fs.renameSync(path.join(stage, name), path.join(destination, name));
    fs.renameSync(
      path.join(stage, manifestName),
      path.join(destination, manifestName),
    );
    committed = true;
    if (backup) {
      const previous = backup;
      try {
        fs.rmSync(previous, { recursive: true });
        backup = undefined;
      } catch {
        warnings.push(
          `Output committed; previous output retained at ${portable(previous)}`,
        );
      }
    }
    return { output: destination, manifest: plan.manifest, warnings };
  } catch (error) {
    const failures: unknown[] = [error];
    if (claimed && !committed) {
      try {
        const current = fs.lstatSync(destination);
        if (
          current.dev !== claimed.dev ||
          current.ino !== claimed.ino ||
          current.isSymbolicLink()
        )
          throw new Error("Output identity changed; refusing cleanup");
        fs.rmSync(destination, { recursive: true });
      } catch (cleanup) {
        failures.push(cleanup);
      }
    }
    if (backup && !committed) {
      try {
        if (fs.existsSync(destination))
          throw new Error(
            `Cannot restore previous output; it remains at ${backup}`,
          );
        fs.renameSync(path.join(backup, "previous"), destination);
        fs.rmdirSync(backup);
        backup = undefined;
      } catch (restore) {
        failures.push(restore);
      }
    }
    if (failures.length > 1)
      throw new AggregateError(
        failures,
        failures
          .map((e) => (e instanceof Error ? e.message : String(e)))
          .join("; "),
      );
    throw error;
  } finally {
    const failures: unknown[] = [];
    if (stage)
      try {
        fs.rmSync(stage, { recursive: true });
      } catch (e) {
        failures.push(e);
      }
    if (lock)
      try {
        fs.rmdirSync(lock);
      } catch (e) {
        failures.push(e);
      }
    if (!committed)
      for (const directory of parents.reverse())
        try {
          fs.rmdirSync(directory);
        } catch {
          /* Preserve nonempty parents created by another process. */
        }
    if (failures.length)
      throw new AggregateError(
        failures,
        `${committed ? "Output committed, but" : "Failed output;"} temporary cleanup failed`,
      );
  }
}
