import * as fs from "node:fs";
import * as path from "node:path";
import { decodeAmxd } from "../amxd/codec.js";
import { validateDeviceProject } from "../amxd/validate.js";
import { parsePatch } from "../io/parse.js";
import { walkPatch } from "../nested.js";
import { validateGraph } from "../validate/graph.js";
import { MaxpatValidationError } from "../errors.js";
import { checkPath, inside, portable, projectRoot, readSafe } from "./files.js";
import type { NormalizedPatch } from "../types.js";

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
export const LIMITATIONS = [
  "Static discovery is not exhaustive: JavaScript imports, message-driven file access, dynamic names and Max's global search path are not evaluated.",
  "Unqualified objects are classified as abstractions only when a matching local .maxpat or dependency_cache entry exists. Native externals may require platform-specific installation and licences.",
  "Adjacent LICENSE, LICENCE, COPYING and NOTICE files are included; developers must explicitly include any other required attribution with --asset.",
];
export type Discovery = {
  file: string;
  roots: string[];
  devicePath: string;
  dependencies: Dependency[];
  /** Owned source snapshots; not included in CLI JSON. */
  files: Map<
    string,
    {
      source: string;
      bytes: Buffer;
      patch?: NormalizedPatch;
      device?: ReturnType<typeof decodeAmxd>;
    }
  >;
};
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const extension =
  /\.(?:js|mjs|cjs|json|maxpat|gendsp|genexpr|wav|aif|aiff|flac|mp3|ogg|png|jpg|jpeg|svg|mov|mp4|mxo|mxe64)$/i;
const dynamic = (s: string) => /#[0-9]|\$[0-9]|[\r\n\0;,]/.test(s);
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

/** CLI implementation detail: resolve explicit project files without consulting global Max paths. */
export function discover(
  input: string,
  options: { roots?: string[]; assets?: string[] } = {},
): Discovery {
  const supplied = path.resolve(input);
  const inputs = options.roots?.length
    ? options.roots
    : [path.dirname(supplied)];
  if (inputs.length > 16 || (options.assets?.length ?? 0) > 1024)
    throw new Error("At most 16 roots and 1024 explicit assets are supported");
  const rootSpecs = inputs.map((r) => ({
    input: path.resolve(r),
    root: projectRoot(path.resolve(r)),
  }));
  const roots = [...new Set(rootSpecs.map((s) => s.root))];
  // Canonicalise the declared root alias (e.g. /tmp), retaining components below it for symlink checks.
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
  const seen = new Set<string>();
  const refs = new Map<string, Dependency>();
  let totalBytes = 0;
  function destination(owner: string, reference: string): string | undefined {
    const dest = path.posix.normalize(
      path.posix.join(
        path.posix.dirname(owner),
        reference.replaceAll("\\", "/"),
      ),
    );
    return dest === ".." ||
      dest.startsWith("../") ||
      path.posix.isAbsolute(dest)
      ? undefined
      : dest;
  }
  function scan(source: string, dest: string): void {
    const key = source + "\0" + dest;
    if (seen.has(key)) return;
    if (seen.size >= 1024)
      throw new Error("Dependency limit exceeded (1024 files)");
    seen.add(key);
    const bytes = readSafe(source, roots);
    totalBytes += bytes.length;
    if (totalBytes > 256 * 1024 * 1024)
      throw new Error("Package exceeds 256 MiB");
    let patch: NormalizedPatch | undefined,
      device: ReturnType<typeof decodeAmxd> | undefined;
    if (source === file && path.extname(source).toLowerCase() === ".amxd") {
      device = decodeAmxd(bytes);
      validateDeviceProject(device);
      patch = device.patch;
    } else if (path.extname(source).toLowerCase() === ".maxpat")
      patch = parsePatch(bytes.toString("utf8"));
    else if (source === file)
      throw new Error("Expected a .maxpat or supported .amxd source");
    if (patch) {
      const validation = validateGraph(patch);
      if (!validation.ok)
        throw new MaxpatValidationError(
          `Invalid graph in ${source}`,
          validation.diagnostics,
        );
    }
    // Store original spelling for the distribution manifest; compare separately below.
    for (const [existing, entry] of result.files)
      if (
        existing.toLowerCase() === dest.toLowerCase() &&
        entry.source !== source
      )
        throw new Error(`Filename collision: ${dest}`);
    result.files.set(dest, {
      source,
      bytes,
      ...(patch ? { patch } : {}),
      ...(device ? { device } : {}),
    });
    for (const entry of fs
      .readdirSync(path.dirname(source), {
        withFileTypes: true,
      })
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)))
      if (
        entry.name !== path.basename(source) &&
        /^(LICENSE|LICENCE|COPYING|NOTICE)(?:[._-].*)?$/i.test(entry.name)
      ) {
        add(
          entry.name,
          "asset",
          source,
          dest,
          portable(path.relative(roots[0], source)) + "/adjacent attribution",
        );
      }
    if (!patch) return;
    for (const scope of walkPatch(patch)) {
      const origin = `${portable(path.relative(roots[0], source))}#${scope.path.length ? "/" + scope.path.join("/") : ""}`;
      const cache = scope.patch.patcherMeta.passthrough.dependency_cache;
      if (
        cache !== undefined &&
        (!Array.isArray(cache) ||
          cache.some(
            (item) =>
              !record(item) || typeof item.name !== "string" || !item.name,
          ))
      )
        throw new Error(`Malformed dependency_cache in ${origin}`);
      const cached = Array.isArray(cache) ? cache.filter(record) : [];
      for (const item of cached)
        if (typeof item.name === "string")
          add(
            item.name,
            "cache",
            source,
            dest,
            origin + "/dependency_cache",
            undefined,
            [item.bootpath, item.patcherrelativepath].filter(
              (s): s is string => typeof s === "string",
            ),
          );
      const project = scope.patch.patcherMeta.passthrough.project;
      if (record(project) && record(project.contents))
        for (const group of Object.values(project.contents))
          if (record(group))
            for (const name of Object.keys(group)) {
              if (extension.test(name))
                add(name, "project", source, dest, origin + "/project");
            }
      for (const box of scope.patch.boxes.values()) {
        const sourceLabel = origin + "/" + box.id;
        const attrs = box.passthrough;
        if (box.maxclass === "bpatcher" && !attrs.patcher) {
          add(
            typeof attrs.name === "string" ? attrs.name : "<dynamic bpatcher>",
            "patcher",
            source,
            dest,
            sourceLabel,
            ".maxpat",
          );
        }
        if (
          box.maxclass === "fpic" &&
          typeof attrs.pic === "string" &&
          attrs.pic
        )
          add(attrs.pic, "media", source, dest, sourceLabel);
        if (
          ["jsui", "v8ui"].includes(box.maxclass) &&
          typeof attrs.filename === "string"
        )
          add(attrs.filename, "javascript", source, dest, sourceLabel, ".js");
        const text =
          box.maxclass === "newobj" && typeof attrs.text === "string"
            ? attrs.text
            : "";
        const parts = tokens(text),
          object = parts[0] ?? text.trim().split(/\s+/)[0];
        if (["js", "v8", "jsui", "v8ui"].includes(object))
          add(
            parts[1] && !parts[1].startsWith("@")
              ? parts[1]
              : "<dynamic script>",
            "javascript",
            source,
            dest,
            sourceLabel,
            ".js",
          );
        else if (
          object === "buffer~" &&
          parts[2] &&
          !parts[2].startsWith("@") &&
          !Number.isFinite(Number(parts[2]))
        )
          add(parts[2], "media", source, dest, sourceLabel);
        else if (object === "bpatcher" && !attrs.patcher) {
          const at = parts.indexOf("@name");
          add(
            at >= 0
              ? (parts[at + 1] ?? "<dynamic bpatcher>")
              : "<dynamic bpatcher>",
            "patcher",
            source,
            dest,
            sourceLabel,
            ".maxpat",
          );
        } else if (
          object &&
          !attrs.patcher &&
          !["p", "patcher"].includes(object)
        ) {
          if (/\.maxpat$/i.test(object))
            add(object, "patcher", source, dest, sourceLabel);
          else if (/[\\/]/.test(object))
            add(object, "patcher", source, dest, sourceLabel, ".maxpat");
          else if (
            !object.startsWith("@") &&
            roots.some((root) =>
              [path.dirname(source), root].some((dir) => {
                const candidate = path.resolve(dir, object + ".maxpat");
                return (
                  roots.some((root) => inside(root, candidate)) &&
                  fs.existsSync(candidate)
                );
              }),
            )
          )
            add(object, "patcher", source, dest, sourceLabel, ".maxpat");
        }
        if (Array.isArray(attrs.clips))
          for (const clip of attrs.clips)
            if (record(clip) && typeof clip.filename === "string")
              add(clip.filename, "media", source, dest, sourceLabel);
      }
    }
  }
  function add(
    reference: string,
    kind: Dependency["kind"],
    source: string,
    owner: string,
    label: string,
    suffix?: string,
    hints: string[] = [],
  ): void {
    const key = path.posix.dirname(owner) + "\0" + reference;
    const previous = refs.get(key);
    if (previous) {
      if (!previous.sources.includes(label)) previous.sources.push(label);
      return;
    }
    if (refs.size >= 4096)
      throw new Error("Dependency reference limit exceeded (4096)");
    const dep: Dependency = {
      reference,
      kind,
      status: "missing",
      sources: [label],
    };
    refs.set(key, dep);
    result.dependencies.push(dep);
    if (
      dynamic(reference) ||
      reference.startsWith("<") ||
      reference.startsWith("~") ||
      path.isAbsolute(reference) ||
      /^(?:[a-zA-Z]:|[a-z]+:)/.test(reference)
    ) {
      dep.status = "unresolved";
      dep.reason =
        "Dynamic or absolute reference requires an explicit relative reference before packaging";
      return;
    }
    const names = [
      reference,
      ...(suffix && !path.extname(reference) ? [reference + suffix] : []),
    ];
    const candidates = new Set<string>();
    for (const base of [
      path.dirname(source),
      ...roots,
      ...hints.map((h) => path.resolve(path.dirname(source), h)),
    ])
      for (const name of names) {
        const candidate = path.resolve(base, name);
        if (!roots.some((root) => inside(root, candidate))) continue;
        try {
          checkPath(candidate, roots);
          if (fs.lstatSync(candidate).isFile()) candidates.add(candidate);
        } catch (e) {
          if (!absent(e)) throw e;
        }
      }
    if (candidates.size > 1) {
      dep.status = "ambiguous";
      dep.reason = "More than one project file matches";
      dep.candidates = [...candidates].sort();
      return;
    }
    const resolved = [...candidates][0];
    if (!resolved) {
      dep.reason = "No regular file found inside the project roots";
      return;
    }
    const name =
      !path.extname(reference) && suffix && resolved.endsWith(suffix)
        ? reference + suffix
        : reference;
    const dest = destination(owner, name);
    if (!dest) {
      dep.status = "unresolved";
      dep.reason = "Reference escapes the distribution layout root";
      return;
    }
    dep.status = "resolved";
    dep.resolvedPath = resolved;
    dep.destination = dest;
    scan(resolved, dest);
  }
  scan(file, result.devicePath);
  for (const asset of options.assets ?? []) {
    const candidate = canonical(path.resolve(asset));
    checkPath(candidate, roots);
    const root = roots.find((root) => inside(root, candidate))!;
    const dest = portable(path.relative(root, candidate));
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
