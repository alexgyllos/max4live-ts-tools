import type { NormalizedPatch } from "../types.js";
import type { RawMaxpat, RawPatcher } from "../schema/index.js";
import { MaxpatStructuralError } from "../errors.js";
import { parseStructural } from "../validate/structural.js";
import { clone, assertJson } from "../validate/json.js";
/** Safe raw output. Structural integrity and ownership are mandatory even with skipValidation. */
export const denormalize = (patch: NormalizedPatch): RawMaxpat => {
  const fail = (message: string): never => {
    throw new MaxpatStructuralError(message, "<normalized>", [
      { code: "S002", message },
    ]);
  };
  if (patch === null || typeof patch !== "object")
    fail("Expected normalized patch object");
  if (
    Object.getPrototypeOf(patch) !== Object.prototype &&
    Object.getPrototypeOf(patch) !== null
  )
    fail("Normalized patch must be a plain object");
  const descriptors = Object.getOwnPropertyDescriptors(patch);
  if (
    ["patcherMeta", "boxes", "lines", "boxOrder", "duplicateBoxIds"].some(
      (k) => !Object.hasOwn(descriptors, k),
    )
  )
    fail("Required normalized fields must be own data properties");
  const fields = [
    "patcherMeta",
    "boxes",
    "lines",
    "boxOrder",
    "duplicateBoxIds",
    "rootPassthrough",
    "linesPresent",
  ];
  if (
    Object.getOwnPropertySymbols(patch).length ||
    Object.entries(descriptors).some(
      ([k, d]) => !fields.includes(k) || !("value" in d) || !d.enumerable,
    )
  )
    fail("Normalized patch requires data fields without accessors");
  if (
    patch.linesPresent !== undefined &&
    typeof patch.linesPresent !== "boolean"
  )
    fail("linesPresent must be boolean");
  if (
    !(patch?.boxes instanceof Map) ||
    !Array.isArray(patch.boxOrder) ||
    !Array.isArray(patch.lines) ||
    !Array.isArray(patch.duplicateBoxIds)
  )
    fail("Invalid normalized containers");
  assertJson(patch.patcherMeta);
  assertJson(patch.boxOrder);
  assertJson(patch.lines);
  assertJson(patch.duplicateBoxIds);
  if (patch.duplicateBoxIds.length)
    fail("Duplicate box IDs cannot be serialized");
  if (
    patch.boxOrder.length !== patch.boxes.size ||
    new Set(patch.boxOrder).size !== patch.boxes.size ||
    patch.boxOrder.some((id) => !patch.boxes.has(id))
  )
    fail("boxes and boxOrder must contain exactly the same unique IDs");
  const extra = (v: unknown, reserved: string[]): Record<string, unknown> => {
    if (v === undefined) return {};
    assertJson(v);
    if (typeof v !== "object" || v === null || Array.isArray(v))
      fail("Invalid passthrough metadata");
    if (reserved.some((k) => Object.hasOwn(v as object, k)))
      fail("Passthrough metadata shadows a structural field");
    return v as Record<string, unknown>;
  };
  const raw: RawMaxpat = {
    ...extra(patch.rootPassthrough, ["patcher"]),
    patcher: {
      ...extra(patch.patcherMeta.passthrough, [
        "boxes",
        "lines",
        "rect",
        "appversion",
      ]),
      ...(patch.patcherMeta.rect === undefined
        ? {}
        : { rect: patch.patcherMeta.rect }),
      ...(patch.patcherMeta.appversion === undefined
        ? {}
        : { appversion: patch.patcherMeta.appversion }),
      boxes: patch.boxOrder.map((id) => {
        const b = patch.boxes.get(id)!;
        assertJson(b);
        if (b.id !== id) fail("Map key must equal box ID");
        return {
          ...extra(b.wrapperPassthrough, ["box"]),
          box: {
            ...extra(b.passthrough, [
              "id",
              "maxclass",
              "numinlets",
              "numoutlets",
              "patching_rect",
            ]),
            id: b.id,
            maxclass: b.maxclass,
            numinlets: b.numinlets,
            numoutlets: b.numoutlets,
            patching_rect: b.patchingRect,
          },
        };
      }),
      ...(patch.linesPresent !== false || patch.lines.length
        ? {
            lines: patch.lines.map((l) => ({
              ...extra(l.wrapperPassthrough, ["patchline"]),
              patchline: {
                ...extra(l.passthrough, ["source", "destination"]),
                source: [l.sourceId, l.sourceOutlet],
                destination: [l.destId, l.destInlet],
              },
            })),
          }
        : {}),
    } as RawPatcher,
  };
  return clone(parseStructural(raw, "<normalized>"));
};
