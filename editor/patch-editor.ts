import { validateGraph } from "../validate/graph.js";
import { MaxpatValidationError, MaxpatEditError } from "../errors.js";
import { createIdGenerator } from "./id-gen.js";
import { parsePatchObject, toPatchObject } from "../io/parse.js";
import { assertJson, clone } from "../validate/json.js";
import { RawBoxWrapperSchema } from "../schema/raw-box.js";
import type {
  NormalizedPatch,
  NormalizedBox,
  NormalizedLine,
  PatchlineEndpoint,
  BoxSpec,
  BoxUpdate,
  ValidationResult,
  RuleConfig,
  CustomRule,
  WriteOptions,
  PatcherMeta,
} from "../types.js";
export type MatchOptions = { match?: "exact" | "partial" };
export type BoxQuery = MatchOptions & {
  id?: string;
  maxclass?: string;
  text?: string;
  varname?: string;
};
export type PatcherPath = readonly string[];
function checkMetadata(value: unknown): void {
  assertJson(value);
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new MaxpatEditError("INVALID_METADATA", "Expected metadata object");
}
function checkPath(path: PatcherPath): void {
  assertJson(path);
  if (
    !Array.isArray(path) ||
    path.some((id) => typeof id !== "string" || !id.length)
  )
    throw new MaxpatEditError(
      "INVALID_PATH",
      "Expected array of nonempty box IDs",
    );
}

/** Immutable editor. All public snapshots own their data; revisions share only internal values. */
export class PatchEditor {
  #patch: NormalizedPatch;
  protected constructor(owned: NormalizedPatch) {
    this.#patch = owned;
  }
  protected fork(patch: NormalizedPatch): this {
    const Constructor = this.constructor as typeof PatchEditor;
    return new Constructor(patch) as this;
  }
  static fromNormalized(patch: NormalizedPatch): PatchEditor {
    toPatchObject(patch, { skipValidation: true });
    return new this(clone(patch));
  }
  static fromRaw(raw: unknown): PatchEditor {
    return new this(parsePatchObject(raw));
  }
  findById(id: string): NormalizedBox | undefined {
    const b = this.#patch.boxes.get(id);
    return b === undefined ? undefined : clone(b);
  }
  find(query: BoxQuery = {}): NormalizedBox[] {
    const matches = (actual: unknown, expected: string | undefined): boolean =>
      expected === undefined ||
      (typeof actual === "string" &&
        (query.match === "partial"
          ? actual.includes(expected)
          : actual === expected));
    return this.#patch.boxOrder
      .map((id) => this.#patch.boxes.get(id)!)
      .filter(
        (b) =>
          matches(b.id, query.id) &&
          matches(b.maxclass, query.maxclass) &&
          matches(b.passthrough.text, query.text) &&
          matches(b.passthrough.varname, query.varname),
      )
      .map((b) => clone(b));
  }
  findByClass(maxclass: string, options?: MatchOptions): NormalizedBox[] {
    return this.find({ maxclass, ...options });
  }
  findByText(text: string, options?: MatchOptions): NormalizedBox[] {
    return this.find({ text, ...options });
  }
  findByVarname(varname: string, options?: MatchOptions): NormalizedBox[] {
    return this.find({ varname, ...options });
  }
  linesFrom(id: string): NormalizedLine[] {
    return clone(this.#patch.lines.filter((l) => l.sourceId === id));
  }
  linesTo(id: string): NormalizedLine[] {
    return clone(this.#patch.lines.filter((l) => l.destId === id));
  }
  private requireBox(id: string): NormalizedBox {
    const b = this.#patch.boxes.get(id);
    if (!b) throw new MaxpatEditError("BOX_NOT_FOUND", `Box ${id} not found`);
    return b;
  }
  private checkBox(b: NormalizedBox): void {
    assertJson(b);
    checkMetadata(b.passthrough);
    const result = RawBoxWrapperSchema.safeParse({
      box: {
        ...b.passthrough,
        id: b.id,
        maxclass: b.maxclass,
        numinlets: b.numinlets,
        numoutlets: b.numoutlets,
        patching_rect: b.patchingRect,
      },
    });
    if (!result.success)
      throw new MaxpatEditError("INVALID_BOX", result.error.message);
    if (
      ["id", "maxclass", "numinlets", "numoutlets", "patching_rect"].some((k) =>
        Object.hasOwn(b.passthrough, k),
      )
    )
      throw new MaxpatEditError(
        "INVALID_BOX",
        "Attributes cannot shadow box structural fields",
      );
    if (b.passthrough.patcher !== undefined)
      parsePatchObject({ patcher: b.passthrough.patcher });
  }
  addBox(spec: BoxSpec, explicitId?: string): this {
    assertJson(spec);
    if (spec === null || typeof spec !== "object" || Array.isArray(spec))
      throw new MaxpatEditError("INVALID_BOX", "Expected box spec object");
    if (
      Object.keys(spec).some(
        (k) =>
          ![
            "maxclass",
            "numinlets",
            "numoutlets",
            "patchingRect",
            "passthrough",
          ].includes(k),
      )
    )
      throw new MaxpatEditError("INVALID_BOX", "Unknown box spec field");
    if (spec.passthrough !== undefined) checkMetadata(spec.passthrough);
    const id = explicitId ?? createIdGenerator(this.#patch)();
    if (this.#patch.boxes.has(id))
      throw new MaxpatEditError("ID_EXISTS", `Box ${id} already exists`);
    const b: NormalizedBox = {
      id,
      maxclass: spec.maxclass,
      numinlets: spec.numinlets,
      numoutlets: spec.numoutlets,
      patchingRect: clone(spec.patchingRect),
      passthrough: clone(spec.passthrough ?? {}),
    };
    this.checkBox(b);
    const boxes = new Map(this.#patch.boxes);
    boxes.set(id, b);
    return this.fork({
      ...this.#patch,
      boxes,
      boxOrder: [...this.#patch.boxOrder, id],
    });
  }
  updateBox(id: string, updates: BoxUpdate): this {
    const original = this.requireBox(id);
    assertJson(updates);
    if (
      updates === null ||
      typeof updates !== "object" ||
      Array.isArray(updates)
    )
      throw new MaxpatEditError("INVALID_BOX", "Expected update object");
    if (
      Object.keys(updates).some(
        (k) =>
          ![
            "maxclass",
            "numinlets",
            "numoutlets",
            "patchingRect",
            "passthrough",
          ].includes(k),
      )
    )
      throw new MaxpatEditError("INVALID_BOX", "Unknown update field");
    if (updates.passthrough !== undefined) checkMetadata(updates.passthrough);
    const b: NormalizedBox = {
      ...original,
      ...clone(updates),
      passthrough: {
        ...original.passthrough,
        ...clone(updates.passthrough ?? {}),
      },
    };
    this.checkBox(b);
    if (
      this.#patch.lines.some(
        (l) =>
          (l.sourceId === id && l.sourceOutlet >= b.numoutlets) ||
          (l.destId === id && l.destInlet >= b.numinlets),
      )
    )
      throw new MaxpatEditError(
        "CONNECTED_PORT_REMOVED",
        "Disconnect affected lines before reducing port counts",
      );
    const boxes = new Map(this.#patch.boxes);
    boxes.set(id, b);
    return this.fork({ ...this.#patch, boxes });
  }
  removeBox(id: string): this {
    this.requireBox(id);
    const boxes = new Map(this.#patch.boxes);
    boxes.delete(id);
    return this.fork({
      ...this.#patch,
      boxes,
      boxOrder: this.#patch.boxOrder.filter((x) => x !== id),
      lines: this.#patch.lines.filter(
        (l) => l.sourceId !== id && l.destId !== id,
      ),
    });
  }
  private checkEndpoint(endpoint: PatchlineEndpoint, source: boolean): void {
    assertJson(endpoint);
    if (
      !Array.isArray(endpoint) ||
      endpoint.length !== 2 ||
      typeof endpoint[0] !== "string" ||
      !Number.isSafeInteger(endpoint[1]) ||
      endpoint[1] < 0
    )
      throw new MaxpatEditError(
        "INVALID_ENDPOINT",
        "Expected [boxId, nonnegative integer port]",
      );
    const box = this.requireBox(endpoint[0]);
    if (endpoint[1] >= (source ? box.numoutlets : box.numinlets))
      throw new MaxpatEditError(
        "PORT_OUT_OF_BOUNDS",
        `Port ${endpoint[1]} out of bounds for ${endpoint[0]}`,
      );
  }
  connect(
    src: PatchlineEndpoint,
    dst: PatchlineEndpoint,
    meta: Record<string, unknown> = {},
  ): this {
    this.checkEndpoint(src, true);
    this.checkEndpoint(dst, false);
    assertJson(meta);
    if (
      typeof meta !== "object" ||
      meta === null ||
      Array.isArray(meta) ||
      Object.hasOwn(meta, "source") ||
      Object.hasOwn(meta, "destination")
    )
      throw new MaxpatEditError(
        "INVALID_LINE_METADATA",
        "Metadata cannot shadow endpoints",
      );
    const exists = this.#patch.lines.find(
      (l) =>
        l.sourceId === src[0] &&
        l.sourceOutlet === src[1] &&
        l.destId === dst[0] &&
        l.destInlet === dst[1],
    );
    if (exists) {
      if (Object.keys(meta).length)
        throw new MaxpatEditError(
          "LINE_EXISTS",
          "Connection exists; disconnect it before changing metadata",
        );
      return this;
    }
    return this.fork({
      ...this.#patch,
      linesPresent: true,
      lines: [
        ...this.#patch.lines,
        {
          sourceId: src[0],
          sourceOutlet: src[1],
          destId: dst[0],
          destInlet: dst[1],
          passthrough: clone(meta),
        },
      ],
    });
  }
  disconnect(src: PatchlineEndpoint, dst: PatchlineEndpoint): this {
    for (const endpoint of [src, dst]) {
      assertJson(endpoint);
      if (
        !Array.isArray(endpoint) ||
        endpoint.length !== 2 ||
        typeof endpoint[0] !== "string" ||
        !endpoint[0].length ||
        !Number.isSafeInteger(endpoint[1]) ||
        endpoint[1] < 0
      )
        throw new MaxpatEditError(
          "INVALID_ENDPOINT",
          "Expected [boxId, nonnegative integer port]",
        );
    }
    const lines = this.#patch.lines.filter(
      (l) =>
        !(
          l.sourceId === src[0] &&
          l.sourceOutlet === src[1] &&
          l.destId === dst[0] &&
          l.destInlet === dst[1]
        ),
    );
    return lines.length === this.#patch.lines.length
      ? this
      : this.fork({ ...this.#patch, lines });
  }
  withMetadata(meta: Partial<PatcherMeta>): this {
    assertJson(meta);
    if (
      meta === null ||
      typeof meta !== "object" ||
      Array.isArray(meta) ||
      Object.keys(meta).some(
        (k) => !["rect", "appversion", "passthrough"].includes(k),
      )
    )
      throw new MaxpatEditError(
        "INVALID_METADATA",
        "Expected rect, appversion or passthrough metadata",
      );
    if (meta.passthrough !== undefined) checkMetadata(meta.passthrough);
    const patcherMeta = {
      ...this.#patch.patcherMeta,
      ...clone(meta),
      passthrough: {
        ...this.#patch.patcherMeta.passthrough,
        ...clone(meta.passthrough ?? {}),
      },
    };
    const next = { ...this.#patch, patcherMeta };
    toPatchObject(next, { skipValidation: true });
    return this.fork(next);
  }
  /** Scope path is a sequence of containing box IDs; external bpatchers have no embedded graph. */
  atPath(path: PatcherPath): PatchEditor {
    checkPath(path);
    checkPath(path);
    if (path.length > 24)
      throw new MaxpatEditError(
        "DEPTH_LIMIT",
        "Patcher path exceeds 24 scopes",
      );
    let editor: PatchEditor = this;
    for (const id of path) {
      const b = editor.requireBox(id);
      if (b.passthrough.patcher === undefined)
        throw new MaxpatEditError(
          "PATCHER_NOT_FOUND",
          `Box ${id} has no embedded patcher`,
        );
      editor = PatchEditor.fromRaw({ patcher: b.passthrough.patcher });
    }
    return editor;
  }
  /** Replace only the selected embedded graph. Callback receives an isolated editor. */
  editAtPath(
    path: PatcherPath,
    edit: (editor: PatchEditor) => PatchEditor,
  ): this {
    checkPath(path);
    if (path.length > 24)
      throw new MaxpatEditError(
        "DEPTH_LIMIT",
        "Patcher path exceeds 24 scopes",
      );
    if (!path.length) {
      const result = edit(PatchEditor.fromNormalized(this.#patch));
      if (!(result instanceof PatchEditor))
        throw new MaxpatEditError(
          "INVALID_EDIT",
          "Callback must return a PatchEditor",
        );
      return this.fork(result.toNormalized());
    }
    const [id, ...rest] = path;
    const nested = this.atPath([id]).editAtPath(rest, edit);
    return this.updateBox(id, {
      passthrough: { patcher: nested.toRaw({ skipValidation: true }).patcher },
    });
  }
  validate(
    ruleConfig?: RuleConfig,
    customRules?: CustomRule[],
  ): ValidationResult {
    return validateGraph(this.#patch, ruleConfig, customRules);
  }
  validateOrThrow(ruleConfig?: RuleConfig, customRules?: CustomRule[]): void {
    const r = this.validate(ruleConfig, customRules);
    if (!r.ok)
      throw new MaxpatValidationError("Patch validation failed", r.diagnostics);
  }
  toNormalized(): NormalizedPatch {
    return clone(this.#patch);
  }
  toRaw(options?: WriteOptions) {
    return toPatchObject(this.#patch, options);
  }
}
