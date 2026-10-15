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
import {
  LIMITATIONS,
  compareText,
  type Discovery,
  type SourceSnapshot,
} from "./dependencies.js";

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
function sanitise(entry: SourceSnapshot): Buffer {
  if (!entry.patch) return entry.bytes;
  const raw = toPatchObject(entry.patch);
  function clean(patcher: typeof raw.patcher): void {
    // Rebuild optional caches from the relative references instead of development paths.
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
    .sort((a, b) => compareText(a.path, b.path));
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
type Plan = ReturnType<typeof packagePlan>;
type WriteState = {
  destination: string;
  parents: string[];
  stage?: string;
  backup?: string;
  lock?: string;
  claimed?: fs.Stats;
  committed: boolean;
  failure?: unknown;
};
function assertSeparate(discovery: Discovery, destination: string): void {
  if (
    discovery.roots.some((root) => inside(destination, root)) ||
    [...discovery.files.values()].some((file) =>
      inside(destination, file.source),
    )
  )
    throw new Error("Output must not contain any source root or source file");
}
function ensureParent(directory: string, parents: string[]): void {
  if (exists(directory)) {
    if (
      fs.lstatSync(directory).isSymbolicLink() ||
      !fs.statSync(directory).isDirectory()
    )
      throw new Error(
        `Expected a regular output parent directory: ${directory}`,
      );
    return;
  }
  ensureParent(path.dirname(directory), parents);
  fs.mkdirSync(directory);
  parents.push(directory);
}
function assertOutput(destination: string, replace: boolean): void {
  if (!exists(destination)) return;
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
function prepare(
  discovery: Discovery,
  state: WriteState,
  replace: boolean,
): void {
  ensureParent(path.dirname(state.destination), state.parents);
  state.destination = path.join(
    fs.realpathSync(path.dirname(state.destination)),
    path.basename(state.destination),
  );
  assertSeparate(discovery, state.destination);
  const lock = path.join(
    path.dirname(state.destination),
    `.${path.basename(state.destination)}.maxpat-lock`,
  );
  fs.mkdirSync(lock);
  state.lock = lock;
  assertOutput(state.destination, replace);
}
function stageFiles(plan: Plan, state: WriteState): void {
  const stage = fs.mkdtempSync(
    path.join(path.dirname(state.destination), ".maxpat-package-"),
  );
  state.stage = stage;
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
  const expectedManifest = Buffer.from(
    JSON.stringify(plan.manifest, null, 2) + "\n",
  );
  if (
    !readSafe(path.join(stage, manifestName), [stage]).equals(expectedManifest)
  )
    throw new Error("Staged manifest verification failed");
  for (const file of plan.files)
    if (
      hash(readSafe(path.join(stage, file.path), [stage])) !== hash(file.bytes)
    )
      throw new Error(`Staged file verification failed: ${file.path}`);
}
function backupOutput(state: WriteState, replace: boolean): void {
  if (!exists(state.destination)) return;
  assertOutput(state.destination, replace);
  const backup = fs.mkdtempSync(
    path.join(path.dirname(state.destination), ".maxpat-previous-"),
  );
  try {
    fs.renameSync(state.destination, path.join(backup, "previous"));
    state.backup = backup;
  } catch (error) {
    try {
      fs.rmdirSync(backup);
    } catch (error_) {
      throw new AggregateError(
        [error, error_],
        `Failed to move previous output; empty backup cleanup failed at ${backup}`,
      );
    }
    throw error;
  }
}
function publishFiles(state: WriteState): void {
  const stage = state.stage!;
  // Exclusive claim prevents overwriting a concurrent creator's output directory.
  fs.mkdirSync(state.destination);
  state.claimed = fs.lstatSync(state.destination);
  for (const name of fs
    .readdirSync(stage)
    .filter((name) => name !== manifestName)
    .sort(compareText))
    fs.renameSync(path.join(stage, name), path.join(state.destination, name));
  fs.renameSync(
    path.join(stage, manifestName),
    path.join(state.destination, manifestName),
  );
  state.committed = true;
}
function removePrevious(state: WriteState): string[] {
  if (!state.backup) return [];
  const backup = state.backup;
  try {
    fs.rmSync(backup, { recursive: true });
    state.backup = undefined;
    return [];
  } catch {
    return [
      `Output committed; previous output retained at ${portable(backup)}`,
    ];
  }
}
function removeClaimed(state: WriteState): void {
  if (!state.claimed || state.committed) return;
  const current = fs.lstatSync(state.destination);
  if (
    current.dev !== state.claimed.dev ||
    current.ino !== state.claimed.ino ||
    current.isSymbolicLink()
  )
    throw new Error("Output identity changed; refusing cleanup");
  fs.rmSync(state.destination, { recursive: true });
}
function restorePrevious(state: WriteState): void {
  if (!state.backup || state.committed) return;
  if (exists(state.destination))
    throw new Error(
      `Cannot restore previous output; it remains at ${state.backup}`,
    );
  fs.renameSync(path.join(state.backup, "previous"), state.destination);
  fs.rmdirSync(state.backup);
  state.backup = undefined;
}
function rollback(state: WriteState, error: unknown): unknown {
  const failures = [error];
  try {
    removeClaimed(state);
  } catch (error_) {
    failures.push(error_);
  }
  try {
    restorePrevious(state);
  } catch (error_) {
    failures.push(error_);
  }
  if (failures.length === 1) return error;
  return new AggregateError(
    failures,
    failures
      .map((e) => (e instanceof Error ? e.message : String(e)))
      .join("; "),
  );
}
function cleanup(state: WriteState): void {
  const failures: unknown[] = [];
  if (state.stage)
    try {
      fs.rmSync(state.stage, { recursive: true });
    } catch (e) {
      failures.push(e);
    }
  if (state.lock)
    try {
      fs.rmdirSync(state.lock);
    } catch (e) {
      failures.push(e);
    }
  const parents = state.parents.slice();
  parents.reverse();
  if (!state.committed)
    for (const directory of parents)
      try {
        fs.rmdirSync(directory);
      } catch {
        /* Preserve nonempty parents created by another process. */
      }
  if (!failures.length) return;
  if (state.failure !== undefined) failures.unshift(state.failure);
  const outcome = state.committed
    ? `Output committed at ${state.destination}, but`
    : "Failed output;";
  throw new AggregateError(failures, `${outcome} temporary cleanup failed`);
}
/** Stage and validate before an exclusive output claim. Roll back failures; use stable parents.
 * Directory publication is not atomic or power-loss durable. Sources and symlinks are never replaced.
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
  const plan = packagePlan(discovery),
    state: WriteState = {
      destination: path.resolve(output),
      parents: [],
      committed: false,
    };
  assertSeparate(discovery, state.destination);
  try {
    prepare(discovery, state, replace);
    stageFiles(plan, state);
    backupOutput(state, replace);
    publishFiles(state);
    return {
      output: state.destination,
      manifest: plan.manifest,
      warnings: removePrevious(state),
    };
  } catch (error) {
    state.failure = rollback(state, error);
    throw state.failure;
  } finally {
    cleanup(state);
  }
}
