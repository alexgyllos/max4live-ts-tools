import * as fs from "node:fs";
import * as path from "node:path";
import { decodeAmxd } from "../amxd/codec.js";
import { validateDeviceProject } from "../amxd/validate.js";
import { parsePatch } from "../io/parse.js";
import { walkPatch } from "../nested.js";
import { validateGraph } from "../validate/graph.js";
import { MaxpatValidationError } from "../errors.js";
import { checkPath, inside, portable, projectRoot, readSafe } from "./files.js";
import type { NormalizedPatch, NormalizedBox } from "../types.js";

export type Dependency = {
  reference: string;
  kind: "javascript" | "patcher" | "media" | "cache" | "project" | "asset";
  status: "resolved" | "missing" | "unresolved" | "ambiguous";
  sources: string[];
  resolvedPath?: string;
  destination?: string;
  reason?: string;
  candidates?: string[];
};
export type SourceSnapshot = {
  source: string;
  bytes: Buffer;
  patch?: NormalizedPatch;
  device?: ReturnType<typeof decodeAmxd>;
};
export type Discovery = {
  file: string;
  roots: string[];
  devicePath: string;
  dependencies: Dependency[];
  /** Owned source snapshots; not included in CLI JSON. */
  files: Map<string, SourceSnapshot>;
};
export const LIMITATIONS = [
  "Static discovery is not exhaustive: JavaScript imports, message-driven file access, dynamic names and Max's global search path are not evaluated.",
  "Unqualified objects are classified as abstractions only when a matching local .maxpat or dependency_cache entry exists. Native externals may require platform-specific installation and licences.",
  "Adjacent LICENSE, LICENCE, COPYING and NOTICE files are included; developers must explicitly include any other required attribution with --asset.",
];
type Reference = Pick<Dependency, "reference" | "kind"> & {
  label: string;
  suffix?: string;
  hints?: string[];
};
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const extension =
  /\.(?:js|mjs|cjs|json|maxpat|gendsp|genexpr|wav|aif|aiff|flac|mp3|ogg|png|jpg|jpeg|svg|mov|mp4|mxo|mxe64)$/i;
// Code-point ordering is independent of the host locale.
export function compareText(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
function tokens(text: string): string[] {
  const result: string[] = [];
  let word = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') quoted = !quoted;
    else if (c === "\\" && /[\s"\\]/.test(text[i + 1] ?? "")) word += text[++i];
    else if (/\s/.test(c) && !quoted) {
      if (word) result.push(word);
      word = "";
    } else word += c;
  }
  if (word) result.push(word);
  return quoted ? [] : result;
}
function absent(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    ["ENOENT", "ENOTDIR"].includes(String(error.code))
  );
}
function destination(owner: string, reference: string): string | undefined {
  const dest = path.posix.normalize(
    path.posix.join(path.posix.dirname(owner), reference.replaceAll("\\", "/")),
  );
  return dest === ".." || dest.startsWith("../") || path.posix.isAbsolute(dest)
    ? undefined
    : dest;
}
function cacheReferences(cache: unknown, label: string): Reference[] {
  if (cache === undefined) return [];
  if (
    !Array.isArray(cache) ||
    cache.some(
      (item) => !record(item) || typeof item.name !== "string" || !item.name,
    )
  )
    throw new Error(`Malformed dependency_cache in ${label}`);
  if (cache.length > 4096)
    throw new Error("Dependency reference limit exceeded (4096)");
  return (cache as Record<string, unknown>[]).map((item) => ({
    reference: item.name as string,
    kind: "cache",
    label: label + "/dependency_cache",
    hints: [item.bootpath, item.patcherrelativepath].filter(
      (s): s is string => typeof s === "string",
    ),
  }));
}
function projectReferences(project: unknown, label: string): Reference[] {
  if (!record(project) || !record(project.contents)) return [];
  const refs: Reference[] = [];
  for (const group of Object.values(project.contents)) {
    if (!record(group)) continue;
    for (const name of Object.keys(group))
      if (extension.test(name))
        refs.push({
          reference: name,
          kind: "project",
          label: label + "/project",
        });
  }
  return refs;
}
function localAbstraction(
  object: string,
  source: string,
  roots: string[],
): boolean {
  return roots.some((root) =>
    [path.dirname(source), root].some((dir) => {
      const candidate = path.resolve(
        dir,
        object.replaceAll("\\", "/") + ".maxpat",
      );
      return (
        roots.some((root) => inside(root, candidate)) &&
        fs.existsSync(candidate)
      );
    }),
  );
}
function uiReferences(box: NormalizedBox, label: string): Reference[] {
  const attrs = box.passthrough,
    refs: Reference[] = [];
  if (box.maxclass === "bpatcher" && !attrs.patcher)
    refs.push({
      reference:
        typeof attrs.name === "string" ? attrs.name : "<dynamic bpatcher>",
      kind: "patcher",
      label,
      suffix: ".maxpat",
    });
  if (box.maxclass === "fpic" && typeof attrs.pic === "string" && attrs.pic)
    refs.push({ reference: attrs.pic, kind: "media", label });
  if (
    ["jsui", "v8ui"].includes(box.maxclass) &&
    typeof attrs.filename === "string"
  )
    refs.push({
      reference: attrs.filename,
      kind: "javascript",
      label,
      suffix: ".js",
    });
  return refs;
}
function bufferReference(
  parts: string[],
  label: string,
): Reference | undefined {
  const file = attributeFilename(parts, ["@file", "@audiofile"]);
  if (file !== undefined) return { reference: file, kind: "media", label };
  const name = parts[2];
  if (!name || name.startsWith("@") || Number.isFinite(Number(name))) return;
  return { reference: name, kind: "media", label };
}
function attributeFilename(
  parts: string[],
  names: string[],
): string | undefined {
  const index = parts.findIndex((part) => names.includes(part));
  if (index < 0) return;
  const value = parts[index + 1];
  return value && !value.startsWith("@") ? value : "<dynamic filename>";
}
function patcherReference(parts: string[], label: string): Reference {
  const name =
    (parts[0] === "poly~"
      ? attributeFilename(parts, ["@patchername"])
      : undefined) ?? parts[1];
  return {
    reference: name && !name.startsWith("@") ? name : "<dynamic patcher>",
    kind: "patcher",
    label,
    suffix: ".maxpat",
  };
}
function objectReference(
  box: NormalizedBox,
  source: string,
  roots: string[],
  label: string,
): Reference | undefined {
  if (
    box.maxclass !== "newobj" ||
    typeof box.passthrough.text !== "string" ||
    box.passthrough.patcher
  )
    return;
  const text = box.passthrough.text,
    parts = tokens(text),
    object = parts[0] ?? text.trim().split(/\s+/)[0];
  if (["js", "v8", "jsui", "v8ui", "node.script"].includes(object))
    return {
      reference:
        parts[1] && !parts[1].startsWith("@") ? parts[1] : "<dynamic script>",
      kind: "javascript",
      label,
      suffix: ".js",
    };
  if (["poly~", "pfft~"].includes(object))
    return patcherReference(parts, label);
  if (object === "buffer~") return bufferReference(parts, label);
  if (object === "bpatcher") {
    const index = parts.indexOf("@name");
    const name = index >= 0 ? parts[index + 1] : undefined;
    return {
      reference: name ?? "<dynamic bpatcher>",
      kind: "patcher",
      label,
      suffix: ".maxpat",
    };
  }
  if (!object || ["p", "patcher"].includes(object) || object.startsWith("@"))
    return;
  if (/\.maxpat$/i.test(object))
    return { reference: object, kind: "patcher", label };
  if (/[\\/]/.test(object) || localAbstraction(object, source, roots))
    return { reference: object, kind: "patcher", label, suffix: ".maxpat" };
}
function clipReferences(clips: unknown, label: string): Reference[] {
  if (!Array.isArray(clips)) return [];
  return clips
    .filter(record)
    .filter((clip) => typeof clip.filename === "string")
    .map((clip) => ({
      reference: clip.filename as string,
      kind: "media",
      label,
    }));
}
function* graphReferences(
  patch: NormalizedPatch,
  source: string,
  roots: string[],
): Generator<Reference> {
  for (const scope of walkPatch(patch)) {
    const label =
      portable(path.relative(roots[0], source)) +
      "#" +
      scope.path.map((id) => "/" + id).join("");
    yield* cacheReferences(
      scope.patch.patcherMeta.passthrough.dependency_cache,
      label,
    );
    yield* projectReferences(
      scope.patch.patcherMeta.passthrough.project,
      label,
    );
    for (const box of scope.patch.boxes.values()) {
      const boxLabel = label + "/" + box.id;
      yield* uiReferences(box, boxLabel);
      yield* clipReferences(box.passthrough.clips, boxLabel);
      const ref = objectReference(box, source, roots, boxLabel);
      if (ref) yield ref;
    }
  }
}
function attributionReferences(source: string, root: string): Reference[] {
  return fs
    .readdirSync(path.dirname(source), { withFileTypes: true })
    .map((entry) => entry.name)
    .filter(
      (name) =>
        name !== path.basename(source) &&
        /^(LICENSE|LICENCE|COPYING|NOTICE)(?:[._-].*)?$/i.test(name),
    )
    .sort(compareText)
    .map((reference) => ({
      reference,
      kind: "asset",
      label: portable(path.relative(root, source)) + "/adjacent attribution",
    }));
}
function readSource(
  source: string,
  main: string,
  roots: string[],
): SourceSnapshot {
  const bytes = readSafe(source, roots),
    snapshot: SourceSnapshot = { source, bytes };
  if (source === main && path.extname(source).toLowerCase() === ".amxd") {
    snapshot.device = decodeAmxd(bytes);
    validateDeviceProject(snapshot.device);
    snapshot.patch = snapshot.device.patch;
  } else if (path.extname(source).toLowerCase() === ".maxpat")
    snapshot.patch = parsePatch(bytes.toString("utf8"));
  else if (source === main)
    throw new Error("Expected a .maxpat or supported .amxd source");
  if (snapshot.patch) {
    const validation = validateGraph(snapshot.patch);
    if (!validation.ok)
      throw new MaxpatValidationError(
        `Invalid graph in ${source}`,
        validation.diagnostics,
      );
  }
  return snapshot;
}
function candidateExists(candidate: string, roots: string[]): boolean {
  if (!roots.some((root) => inside(root, candidate))) return false;
  try {
    checkPath(candidate, roots);
    return fs.lstatSync(candidate).isFile();
  } catch (e) {
    if (!absent(e)) throw e;
    return false;
  }
}
function candidates(ref: Reference, source: string, roots: string[]): string[] {
  const reference = ref.reference.replaceAll("\\", "/");
  const names = [reference];
  if (ref.suffix && !path.posix.extname(reference))
    names.push(reference + ref.suffix);
  const bases = [
    path.dirname(source),
    ...roots,
    ...(ref.hints ?? []).map((h) =>
      path.resolve(path.dirname(source), h.replaceAll("\\", "/")),
    ),
  ];
  const matches = new Set<string>();
  for (const base of bases)
    for (const name of names) {
      const candidate = path.resolve(base, name);
      if (candidateExists(candidate, roots)) matches.add(candidate);
    }
  return [...matches].sort(compareText);
}
function resolveReference(
  ref: Reference,
  source: string,
  owner: string,
  roots: string[],
): Dependency {
  const { reference, kind, label } = ref;
  const dep: Dependency = {
    reference,
    kind,
    status: "missing",
    sources: [label],
  };
  if (
    /#\d|\$\d|[\r\n\0;,]/.test(reference) ||
    reference.startsWith("<") ||
    reference.startsWith("~") ||
    path.isAbsolute(reference) ||
    path.win32.isAbsolute(reference) ||
    /^(?:[a-zA-Z]:|[a-z]+:)/.test(reference)
  ) {
    return {
      ...dep,
      status: "unresolved",
      reason:
        "Dynamic or absolute reference requires an explicit relative reference before packaging",
    };
  }
  const matches = candidates(ref, source, roots);
  if (matches.length > 1)
    return {
      ...dep,
      status: "ambiguous",
      reason: "More than one project file matches",
      candidates: matches,
    };
  const resolved = matches[0];
  if (!resolved)
    return { ...dep, reason: "No regular file found inside the project roots" };
  const name =
    !path.posix.extname(reference.replaceAll("\\", "/")) &&
    ref.suffix &&
    resolved.endsWith(ref.suffix)
      ? reference + ref.suffix
      : reference;
  const dest = destination(owner, name);
  if (!dest)
    return {
      ...dep,
      status: "unresolved",
      reason: "Reference escapes the distribution layout root",
    };
  return {
    ...dep,
    status: "resolved",
    resolvedPath: resolved,
    destination: dest,
  };
}
function assertUniqueFile(
  files: Discovery["files"],
  source: string,
  dest: string,
): void {
  for (const [existing, entry] of files)
    if (
      existing.toLowerCase() === dest.toLowerCase() &&
      entry.source !== source
    )
      throw new Error(`Filename collision: ${dest}`);
}
/** CLI implementation detail: resolve explicit project files without consulting global Max paths. */
export function discover(
  input: string,
  options: { roots?: string[]; assets?: string[] } = {},
): Discovery {
  const supplied = path.resolve(input),
    inputs = options.roots?.length ? options.roots : [path.dirname(supplied)];
  if (inputs.length > 16 || (options.assets?.length ?? 0) > 1024)
    throw new Error("At most 16 roots and 1024 explicit assets are supported");
  const rootSpecs = inputs.map((r) => ({
    input: path.resolve(r),
    root: projectRoot(path.resolve(r)),
  }));
  const roots = [...new Set(rootSpecs.map((s) => s.root))];
  // Canonicalise only the declared root alias, retaining symlinks below it for checkPath.
  const canonical = (requested: string) => {
    const spec = rootSpecs.find((s) => inside(s.input, requested));
    return spec
      ? path.join(spec.root, path.relative(spec.input, requested))
      : requested;
  };
  const file = canonical(supplied);
  checkPath(file, roots);
  if (!inside(roots[0], file))
    throw new Error(
      "The device must be inside the first --root (the distribution layout root)",
    );
  const result: Discovery = {
    file,
    roots,
    devicePath: portable(path.relative(roots[0], file)),
    dependencies: [],
    files: new Map(),
  };
  const seen = new Set<string>(),
    refs = new Map<string, Dependency>();
  let totalBytes = 0;
  function scan(source: string, dest: string): void {
    const key = source + "\0" + dest;
    if (seen.has(key)) return;
    if (seen.size >= 1024)
      throw new Error("Dependency limit exceeded (1024 files)");
    seen.add(key);
    assertUniqueFile(result.files, source, dest);
    const snapshot = readSource(source, file, roots);
    totalBytes += snapshot.bytes.length;
    if (totalBytes > 256 * 1024 * 1024)
      throw new Error("Package exceeds 256 MiB");
    result.files.set(dest, snapshot);
    for (const ref of attributionReferences(source, roots[0]))
      add(ref, source, dest);
    if (snapshot.patch)
      for (const ref of graphReferences(snapshot.patch, source, roots))
        add(ref, source, dest);
  }
  function add(ref: Reference, source: string, owner: string): void {
    const key = path.posix.dirname(owner) + "\0" + ref.reference,
      previous = refs.get(key);
    if (previous) {
      if (!previous.sources.includes(ref.label))
        previous.sources.push(ref.label);
      return;
    }
    if (refs.size >= 4096)
      throw new Error("Dependency reference limit exceeded (4096)");
    const dep = resolveReference(ref, source, owner, roots);
    refs.set(key, dep);
    result.dependencies.push(dep);
    if (dep.status === "resolved") scan(dep.resolvedPath!, dep.destination!);
  }
  scan(file, result.devicePath);
  for (const asset of options.assets ?? []) {
    const candidate = canonical(path.resolve(asset));
    checkPath(candidate, roots);
    const root = roots.find((root) => inside(root, candidate))!,
      dest = portable(path.relative(root, candidate));
    result.dependencies.push({
      reference: portable(path.relative(roots[0], candidate)),
      kind: "asset",
      status: "resolved",
      sources: ["--asset"],
      resolvedPath: candidate,
      destination: dest,
    });
    scan(candidate, dest);
  }
  return result;
}
