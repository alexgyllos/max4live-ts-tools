import { assertJson } from "../validate/json.js";
import { PatchEditor } from "./patch-editor.js";
import type {
  NormalizedPatch,
  Rect,
  PatchlineEndpoint,
  BoxSpec,
  WriteOptions,
} from "../types.js";
export type BuilderOptions = {
  rect?: Rect;
  appversion?: unknown;
  metadata?: Record<string, unknown>;
};
export type ObjectOptions = {
  id?: string;
  maxclass?: string;
  text?: string;
  varname?: string;
  at?: readonly [number, number];
  size?: readonly [number, number];
  rect?: Rect;
  numinlets: number;
  numoutlets: number;
  attributes?: Record<string, unknown>;
};
/** Fluent immutable builder. Port counts are explicit: object text cannot reliably infer them offline. */
export class PatchBuilder {
  #editor: PatchEditor;
  constructor(options: BuilderOptions = {}) {
    assertJson(options);
    if (
      options === null ||
      typeof options !== "object" ||
      Array.isArray(options)
    )
      throw new TypeError("Expected builder options");
    if (
      options.metadata !== undefined &&
      (options.metadata === null ||
        typeof options.metadata !== "object" ||
        Array.isArray(options.metadata))
    )
      throw new TypeError("Expected metadata object");
    const patch: NormalizedPatch = {
      patcherMeta: {
        passthrough: options.metadata ?? {},
        ...(options.rect === undefined ? {} : { rect: options.rect }),
        ...(options.appversion === undefined
          ? {}
          : { appversion: options.appversion }),
      },
      boxes: new Map(),
      lines: [],
      boxOrder: [],
      duplicateBoxIds: [],
    };
    this.#editor = PatchEditor.fromNormalized(patch);
  }
  private with(editor: PatchEditor): PatchBuilder {
    const next = new PatchBuilder();
    next.#editor = editor;
    return next;
  }
  get editor(): PatchEditor {
    return this.#editor;
  }
  box(spec: BoxSpec, id?: string): PatchBuilder {
    return this.with(this.#editor.addBox(spec, id));
  }
  object(options: ObjectOptions): PatchBuilder {
    assertJson(options);
    if (
      options.attributes !== undefined &&
      (options.attributes === null ||
        typeof options.attributes !== "object" ||
        Array.isArray(options.attributes))
    )
      throw new TypeError("Expected attributes object");
    return this.box(
      {
        maxclass: options.maxclass ?? "newobj",
        numinlets: options.numinlets,
        numoutlets: options.numoutlets,
        patchingRect: options.rect ?? [
          options.at?.[0] ?? 0,
          options.at?.[1] ?? 0,
          options.size?.[0] ?? 80,
          options.size?.[1] ?? 22,
        ],
        passthrough: {
          ...options.attributes,
          ...(options.text === undefined ? {} : { text: options.text }),
          ...(options.varname === undefined
            ? {}
            : { varname: options.varname }),
        },
      },
      options.id,
    );
  }
  connect(
    src: PatchlineEndpoint,
    dst: PatchlineEndpoint,
    meta?: Record<string, unknown>,
  ): PatchBuilder {
    return this.with(this.#editor.connect(src, dst, meta));
  }
  metadata(fields: Record<string, unknown>): PatchBuilder {
    return this.with(this.#editor.withMetadata({ passthrough: fields }));
  }
  toNormalized(): NormalizedPatch {
    return this.#editor.toNormalized();
  }
  toRaw(options?: WriteOptions) {
    return this.#editor.toRaw(options);
  }
}
