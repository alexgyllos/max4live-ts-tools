import { stableStringify } from "../io/serializer.js";
import { MaxpatStructuralError, MaxpatValidationError } from "../errors.js";
export type CliIO = {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
};
export function output(
  io: CliIO,
  json: boolean,
  value: object,
  text: string,
): void {
  io.stdout(
    json ? stableStringify({ schemaVersion: 1, ...value }) + "\n" : text,
  );
}
export function errorOutput(io: CliIO, json: boolean, e: unknown): number {
  const message = e instanceof Error ? e.message : String(e);
  const code =
    e && typeof e === "object" && "code" in e && typeof e.code === "string"
      ? { code: e.code }
      : {};
  const details =
    e instanceof MaxpatValidationError
      ? { diagnostics: e.diagnostics }
      : e instanceof MaxpatStructuralError
        ? { issues: e.issues }
        : {};
  io.stderr(
    json
      ? stableStringify({
          schemaVersion: 1,
          ok: false,
          error: {
            name: e instanceof Error ? e.name : "Error",
            ...code,
            message,
            ...details,
          },
        }) + "\n"
      : message + "\n",
  );
  return e instanceof MaxpatValidationError ? 1 : 2;
}
