import { MaxpatValidationError } from "../errors.js";
import { clone } from "../validate/json.js";
import type { RawMaxpat } from "../schema/raw-maxpat.js";
import type {
  NormalizedPatch,
  NormalizedBox,
  NormalizedLine,
  PatcherMeta,
  Rect,
} from "../types.js";
import {
  PATCHER_META_KNOWN_FIELDS,
  PATCHER_STRUCTURAL_FIELDS,
} from "../constants.js";

const BOX_CORE_FIELDS = new Set([
  "id",
  "maxclass",
  "numinlets",
  "numoutlets",
  "patching_rect",
]);

const LINE_CORE_FIELDS = new Set(["source", "destination"]);

export const normalize = (raw: RawMaxpat): NormalizedPatch => {
  raw = clone(raw);
  const patcher = raw.patcher;
  const rawRecord = patcher as Record<string, unknown>;

  // Build patcherMeta
  const patcherPassthrough: Record<string, unknown> = {};
  let rect: Rect | undefined;
  let appversion: unknown;

  for (const [k, v] of Object.entries(rawRecord)) {
    if (PATCHER_STRUCTURAL_FIELDS.has(k)) continue;
    if (k === "rect") {
      rect = v as Rect;
    } else if (k === "appversion") {
      appversion = v;
    } else if (!PATCHER_META_KNOWN_FIELDS.has(k)) {
      Object.defineProperty(patcherPassthrough, k, {
        value: v,
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
  }

  const patcherMeta: PatcherMeta = {
    passthrough: patcherPassthrough,
  };
  if (rect !== undefined) patcherMeta.rect = rect;
  if (appversion !== undefined) patcherMeta.appversion = appversion;

  // Build boxes map + order
  const boxes = new Map<string, NormalizedBox>();
  const boxOrder: string[] = [];
  const duplicateBoxIds: string[] = [];

  for (const wrapper of patcher.boxes) {
    const rawBox = wrapper.box as Record<string, unknown>;
    const id = rawBox["id"] as string;
    const boxPassthrough: Record<string, unknown> = {};

    for (const [k, v] of Object.entries(rawBox)) {
      if (!BOX_CORE_FIELDS.has(k)) {
        Object.defineProperty(boxPassthrough, k, {
          value: v,
          enumerable: true,
          configurable: true,
          writable: true,
        });
      }
    }

    const rect = rawBox["patching_rect"] as Rect;

    const box: NormalizedBox = {
      id,
      maxclass: rawBox["maxclass"] as string,
      numinlets: rawBox["numinlets"] as number,
      numoutlets: rawBox["numoutlets"] as number,
      patchingRect: rect,
      passthrough: boxPassthrough,
      wrapperPassthrough: Object.fromEntries(
        Object.entries(wrapper).filter(([k]) => k !== "box"),
      ),
    };

    // Duplicate ID handling: first-seen wins; track duplicates for E001
    if (!boxes.has(id)) {
      boxes.set(id, box);
      boxOrder.push(id);
    } else {
      throw new MaxpatValidationError(
        "Duplicate box IDs cannot be normalized losslessly",
        [
          {
            severity: "error",
            code: "E001",
            message: `duplicate box id ${id}`,
            location: { boxId: id },
          },
        ],
      );
    }
  }

  // Build lines
  const rawLines = patcher.lines ?? [];
  const lines: NormalizedLine[] = rawLines.map((wrapper) => {
    const rawLine = wrapper.patchline as Record<string, unknown>;
    const source = rawLine["source"] as [string, number];
    const destination = rawLine["destination"] as [string, number];

    const linePassthrough: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rawLine)) {
      if (!LINE_CORE_FIELDS.has(k)) {
        Object.defineProperty(linePassthrough, k, {
          value: v,
          enumerable: true,
          configurable: true,
          writable: true,
        });
      }
    }

    return {
      sourceId: source[0],
      sourceOutlet: source[1],
      destId: destination[0],
      destInlet: destination[1],
      passthrough: linePassthrough,
      wrapperPassthrough: Object.fromEntries(
        Object.entries(wrapper).filter(([k]) => k !== "patchline"),
      ),
    };
  });

  return {
    patcherMeta,
    boxes,
    lines,
    boxOrder,
    duplicateBoxIds,
    linesPresent: "lines" in patcher,
    rootPassthrough: Object.fromEntries(
      Object.entries(raw).filter(([k]) => k !== "patcher"),
    ),
  };
};
