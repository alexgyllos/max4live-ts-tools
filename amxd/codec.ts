import { decodeRaw, encodeRaw, type DeviceType, type Chunk } from "@tsln/amxd";
import { parsePatch, serializePatch } from "../io/parse.js";
import type { NormalizedPatch, ReadOptions, WriteOptions } from "../types.js";
export type AmxdDeviceType = DeviceType;
export type AmxdChunk = Chunk;
export type AmxdContainer = {
  version: number;
  meta: number;
  /** All original chunks, including meta and ptch, in their original order. */
  chunks: readonly AmxdChunk[];
};
export type AmxdDevice = {
  type: AmxdDeviceType;
  patch: NormalizedPatch;
  /** Keep this value when editing a decoded device to retain its container. */
  container?: AmxdContainer;
};
export class AmxdError extends Error {
  constructor(
    readonly code: "MALFORMED_AMXD" | "UNSUPPORTED_AMXD",
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "AmxdError";
  }
}
const MAX_BYTES = 64 * 1024 * 1024;
const tagAt = (bytes: Uint8Array, offset = 0): string =>
  String.fromCharCode(...bytes.subarray(offset, offset + 4));
const malformed = (message: string): never => {
  throw new AmxdError("MALFORMED_AMXD", message);
};
const frozen = (): never => {
  throw new AmxdError(
    "UNSUPPORTED_AMXD",
    "Frozen mx@c devices are not supported; use an unfrozen JSON device",
  );
};
const uint32 = (value: number): boolean =>
  Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
/** Only framing is inspected here, to restore ordering the upstream codec normalises. */
function scan(
  bytes: Uint8Array,
): { tag: string; data: Uint8Array; bytes: Uint8Array }[] {
  if (!(bytes instanceof Uint8Array) || bytes.length > MAX_BYTES)
    malformed("Expected .amxd bytes at most 64 MiB");
  if (tagAt(bytes) === "mx@c") frozen();
  if (bytes.length < 12 || tagAt(bytes) !== "ampf")
    malformed("Missing ampf container header");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(4, true) !== 4)
    throw new AmxdError(
      "UNSUPPORTED_AMXD",
      "Only ampf container version 4 is supported",
    );
  const chunks = [];
  for (let offset = 12; offset < bytes.length;) {
    if (offset + 8 > bytes.length)
      malformed(`Truncated chunk header at byte ${offset}`);
    const tag = tagAt(bytes, offset);
    if (!/^[\x20-\x7e]{4}$/.test(tag))
      malformed(`Invalid chunk tag at byte ${offset}`);
    const end = offset + 8 + view.getUint32(offset + 4, true);
    if (end > bytes.length)
      malformed(`Chunk ${tag} runs past the end of the file`);
    chunks.push({
      tag,
      data: bytes.subarray(offset + 8, end),
      bytes: bytes.subarray(offset, end),
    });
    if (chunks.length > 100_000) malformed("Too many container chunks");
    offset = end;
  }
  return chunks;
}
function checkChunks(chunks: readonly AmxdChunk[]): {
  patch: AmxdChunk;
  text: string;
} {
  let size = 12;
  for (const chunk of chunks) {
    if (
      !chunk ||
      typeof chunk !== "object" ||
      !/^[\x20-\x7e]{4}$/.test(chunk.tag) ||
      !(chunk.data instanceof Uint8Array)
    )
      malformed("Invalid container chunk");
    size += 8 + chunk.data.length;
    if (size > MAX_BYTES) malformed("Container chunks exceed 64 MiB");
    if (chunk.tag === "mx@c") frozen();
    if (chunk.tag === "ciph")
      throw new AmxdError(
        "UNSUPPORTED_AMXD",
        "Encrypted ciph devices are not supported",
      );
  }
  const patches = chunks.filter((c) => c.tag === "ptch");
  const metas = chunks.filter((c) => c.tag === "meta");
  if (patches.length !== 1 || metas.length !== 1 || metas[0].data.length !== 4)
    malformed("Expected one ptch chunk and one 4-byte meta chunk");
  const patch = patches[0];
  if (tagAt(patch.data) === "mx@c") frozen();
  let end = patch.data.length;
  while (end > 0 && patch.data[end - 1] === 0) end--;
  try {
    return {
      patch,
      text: new TextDecoder("utf-8", { fatal: true }).decode(
        patch.data.subarray(0, end),
      ),
    };
  } catch (cause) {
    throw new AmxdError(
      "MALFORMED_AMXD",
      "Patcher payload is not valid UTF-8",
      { cause },
    );
  }
}
/** Decodes unfrozen ampf/JSON devices; owns the returned patch and binary chunks. */
export function decodeAmxd(
  bytes: Uint8Array,
  options?: ReadOptions,
): AmxdDevice {
  const chunks = scan(bytes);
  const { text } = checkChunks(chunks);
  let raw;
  try {
    raw = decodeRaw(bytes);
  } catch (cause) {
    throw new AmxdError("MALFORMED_AMXD", "Invalid .amxd container", { cause });
  }
  return {
    type: raw.type,
    patch: parsePatch(text, options, "<amxd>"),
    container: {
      version: raw.version,
      meta: raw.meta,
      chunks: chunks.map((c) => ({
        tag: c.tag,
        data: Uint8Array.from(c.data),
      })),
    },
  };
}
/** Encodes with @tsln/amxd; retains original text when the patch is unchanged. */
export function encodeAmxd(
  device: AmxdDevice,
  options?: WriteOptions,
): Uint8Array {
  const text = serializePatch(device.patch, options);
  const project = device.patch.patcherMeta.passthrough.project;
  if (project !== undefined) {
    if (
      !project ||
      typeof project !== "object" ||
      Array.isArray(project) ||
      ["searchpath", "layout", "contents"].some((key) => {
        const value = (project as Record<string, unknown>)[key];
        return !value || typeof value !== "object" || Array.isArray(value);
      })
    )
      malformed(
        "Device project metadata requires searchpath, layout and contents dictionaries",
      );
  }

  if (!["audio", "midi", "instrument"].includes(device.type))
    malformed("Expected audio, midi or instrument device type");
  const { version = 4, meta = 0 } = device.container ?? {};
  if (!uint32(version) || version !== 4)
    throw new AmxdError(
      "UNSUPPORTED_AMXD",
      "Only ampf container version 4 is supported",
    );
  if (!uint32(meta)) malformed("Container meta must be a uint32");
  const chunks = device.container?.chunks;
  let original: ReturnType<typeof checkChunks> | undefined;
  let unchanged = false;
  if (chunks) {
    if (!Array.isArray(chunks) || chunks.length > 100_000)
      malformed("Invalid container chunk list");
    original = checkChunks(chunks);
    unchanged =
      serializePatch(parsePatch(original.text), { skipValidation: true }) ===
      text;
  }
  const extras =
    chunks?.filter((c) => c.tag !== "meta" && c.tag !== "ptch") ?? [];
  if (
    extras.reduce(
      (size, c) => size + c.data.length + 8,
      new TextEncoder().encode(text).length + 33,
    ) > MAX_BYTES
  )
    malformed("Encoded .amxd exceeds 64 MiB");
  const encoded = encodeRaw({
    version,
    type: device.type,
    meta,
    chunks: extras,
    text,
  });
  if (!chunks) return encoded;
  const segments = scan(encoded);
  const known = new Map(
    segments
      .filter((c) => c.tag === "meta" || c.tag === "ptch")
      .map((c) => [c.tag, c.bytes]),
  );
  let extra = 0;
  // Preserve all chunk positions, including unknown chunks after ptch and before meta.
  // For unchanged patchers retain their original whitespace, numbers and NUL padding.
  const ordered = chunks.map((c) => {
    if (c.tag === "ptch" && unchanged && original) {
      const segment = new Uint8Array(8 + original.patch.data.length);
      segment.set(known.get("ptch")!.subarray(0, 8));
      new DataView(segment.buffer).setUint32(
        4,
        original.patch.data.length,
        true,
      );
      segment.set(original.patch.data, 8);
      return segment;
    }
    return c.tag === "meta" || c.tag === "ptch"
      ? known.get(c.tag)!
      : segments[1 + extra++].bytes;
  });
  const size = 12 + ordered.reduce((n, part) => n + part.length, 0);
  if (size > MAX_BYTES) malformed("Encoded .amxd exceeds 64 MiB");
  const out = new Uint8Array(size);
  out.set(encoded.subarray(0, 12));
  let offset = 12;
  for (const part of ordered) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
