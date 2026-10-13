import { RawMaxpatSchema } from "../schema/raw-maxpat.js";
import type { RawMaxpat } from "../schema/raw-maxpat.js";
import { assertJson, clone } from "./json.js";
import { MaxpatStructuralError } from "../errors.js";

export const parseStructural = (
  value: unknown,
  filePath: string,
): RawMaxpat => {
  assertJson(value, filePath);
  const result = RawMaxpatSchema.safeParse(value);
  if (!result.success) {
    const issues =
      "issues" in result.error ? result.error.issues : [result.error];
    throw new MaxpatStructuralError(
      "Patch failed structural validation",
      filePath,
      issues,
    );
  }
  // Zod is a validator here: its output drops __proto__ keys even in passthrough mode.
  return clone(value as RawMaxpat);
};
