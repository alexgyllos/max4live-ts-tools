import { PatchEditor as CoreEditor } from "./patch-editor.js";
import { readFile } from "../io/reader.js";
import { writeFile } from "../io/writer.js";
import { parsePatchObject, toPatchObject } from "../io/parse.js";
import { clone } from "../validate/json.js";
import type {
  NormalizedPatch,
  ReadOptions,
  FileWriteOptions,
} from "../types.js";
/** Root entrypoint editor adds Node filesystem adapters. */
export class PatchEditor extends CoreEditor {
  static override fromNormalized(patch: NormalizedPatch): PatchEditor {
    toPatchObject(patch, { skipValidation: true });
    return new this(clone(patch));
  }
  static override fromRaw(raw: unknown): PatchEditor {
    return new this(parsePatchObject(raw));
  }
  static fromFile(path: string, options?: ReadOptions): PatchEditor {
    return new this(readFile(path, options));
  }
  write(path: string, options?: FileWriteOptions): void {
    writeFile(path, this.toNormalized(), options);
  }
}
