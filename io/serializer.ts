import { assertJson } from "../validate/json.js";
import {
  TOP_LEVEL_KEY_ORDER,
  APPVERSION_KEY_ORDER,
  PATCHER_KEY_ORDER,
  BOX_KEY_ORDER,
  PATCHLINE_KEY_ORDER,
} from "../constants.js";

const sortKeys = (
  obj: Record<string, unknown>,
  knownOrder: readonly string[],
): string[] => {
  const known = knownOrder.filter((k) => Object.hasOwn(obj, k));
  const unknown = Object.keys(obj)
    .filter((k) => !knownOrder.includes(k))
    .sort();
  return [...known, ...unknown];
};

const detectKeyOrder = (key: string): readonly string[] | null => {
  if (key === "") return TOP_LEVEL_KEY_ORDER;
  if (key === "patcher") return PATCHER_KEY_ORDER;
  if (key === "appversion") return APPVERSION_KEY_ORDER;
  if (key === "box") return BOX_KEY_ORDER;
  if (key === "patchline") return PATCHLINE_KEY_ORDER;
  return null;
};

// Recursively serialize with stable key ordering.
const stableValue = (value: unknown, contextKey: string): unknown => {
  if (value === null || typeof value !== "object") return value;

  if (Array.isArray(value)) {
    return value.map((item) => stableValue(item, ""));
  }

  const obj = value as Record<string, unknown>;
  const keyOrder = detectKeyOrder(contextKey);
  const orderedKeys = keyOrder
    ? sortKeys(obj, keyOrder)
    : Object.keys(obj).sort();

  const result: Record<string, unknown> = {};
  for (const k of orderedKeys) {
    Object.defineProperty(result, k, {
      value: stableValue(obj[k], k),
      enumerable: true,
    });
  }
  return result;
};

export const stableStringify = (value: unknown): string => {
  assertJson(value);
  const ordered = stableValue(value, "");
  // JSON.stringify coerces -0 to 0; retain that valid JSON numeric value.
  const render = (v: unknown, depth: number): string => {
    if (v === null || typeof v !== "object")
      return Object.is(v, -0) ? "-0" : JSON.stringify(v);
    const pad = "  ".repeat(depth);
    const childPad = pad + "  ";
    if (Array.isArray(v))
      return v.length
        ? "[\n" +
            v.map((x) => childPad + render(x, depth + 1)).join(",\n") +
            "\n" +
            pad +
            "]"
        : "[]";
    const entries = Object.entries(v);
    return entries.length
      ? "{\n" +
          entries
            .map(
              ([k, x]) =>
                childPad + JSON.stringify(k) + ": " + render(x, depth + 1),
            )
            .join(",\n") +
          "\n" +
          pad +
          "}"
      : "{}";
  };
  return render(ordered, 0);
};
