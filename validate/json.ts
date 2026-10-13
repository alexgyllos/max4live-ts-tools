import { MaxpatStructuralError } from "../errors.js";
/** Reject values JSON would silently coerce/drop. Bound recursion before Zod/stringify. */
export function assertJson(value: unknown, source = "<memory>"): void {
  const active = new Set<object>();
  let nodes = 0;
  const fail = (path: string, message: string): never => {
    throw new MaxpatStructuralError(message, source, [
      { code: "S001", path, message },
    ]);
  };
  function visit(v: unknown, path: string, depth: number): void {
    if (++nodes > 1000000 || depth > 128)
      fail(
        path,
        "JSON resource limit exceeded (depth 128, one million values)",
      );
    if (v === null || typeof v === "string" || typeof v === "boolean") return;
    if (typeof v === "number" && Number.isFinite(v)) return;
    if (typeof v !== "object" || v === null)
      fail(path, "Expected finite JSON value");
    const obj = v as object;
    if (active.has(obj)) fail(path, "Cyclic JSON value");
    if (
      !Array.isArray(obj) &&
      Object.getPrototypeOf(obj) !== Object.prototype &&
      Object.getPrototypeOf(obj) !== null
    )
      fail(path, "Expected plain JSON object");
    if (Object.getOwnPropertySymbols(obj).length)
      fail(path, "Symbol keys are not JSON");
    active.add(obj);
    const descriptors = Object.getOwnPropertyDescriptors(obj);
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        const d = descriptors[String(i)];
        if (!d || !("value" in d))
          fail(path, "Sparse/accessor array is not JSON");
        visit(d.value, `${path}/${i}`, depth + 1);
      }
      if (
        Object.keys(descriptors).some(
          (k) =>
            k !== "length" &&
            (!/^(0|[1-9]\d*)$/.test(k) || Number(k) >= obj.length),
        )
      )
        fail(path, "Array properties are not JSON");
    } else
      for (const [k, d] of Object.entries(descriptors)) {
        if (!("value" in d) || !d.enumerable)
          fail(path, "Accessor/non-enumerable property is not JSON");
        visit(d.value, `${path}/${k}`, depth + 1);
      }
    active.delete(obj);
  }
  visit(value, "", 0);
}
export const clone = <T>(value: T): T => structuredClone(value);
