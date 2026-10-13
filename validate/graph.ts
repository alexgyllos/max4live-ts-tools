import type {
  NormalizedPatch,
  ValidationResult,
  Diagnostic,
  RuleConfig,
  CustomRule,
  Severity,
} from "../types.js";
import { BUILTIN_RULES } from "./rules.js";
import { toPatchObject } from "../io/parse.js";
import { normalize } from "../normalize/normalize.js";
import { clone, assertJson } from "./json.js";
/** Validates structure and embedded graphs; overrides apply to graph diagnostics. */
export const validateGraph = (
  patch: NormalizedPatch,
  ruleConfig?: RuleConfig,
  customRules?: CustomRule[],
): ValidationResult => {
  const diagnostics: Diagnostic[] = [];
  if (ruleConfig !== undefined) {
    try {
      assertJson(ruleConfig);
      if (
        ruleConfig === null ||
        typeof ruleConfig !== "object" ||
        Array.isArray(ruleConfig) ||
        Object.values(ruleConfig).some(
          (v) =>
            typeof v !== "string" ||
            !["error", "warning", "info", "off"].includes(v),
        )
      )
        throw new Error(
          "Invalid rule override (expected error, warning, info or off)",
        );
    } catch (e) {
      return {
        ok: false,
        diagnostics: [
          {
            severity: "error",
            code: "S001",
            message: e instanceof Error ? e.message : String(e),
          },
        ],
      };
    }
  }
  function scope(current: NormalizedPatch, path: string[]): void {
    for (const rule of BUILTIN_RULES) {
      const override =
        ruleConfig && Object.hasOwn(ruleConfig, rule.code)
          ? ruleConfig[rule.code]
          : undefined;
      if (override === "off") continue;
      const severity: Severity = override ?? rule.defaultSeverity;
      for (const d of rule.check(current))
        diagnostics.push({
          ...d,
          severity,
          location: {
            ...d.location,
            ...(path.length ? { path: JSON.stringify(path) } : {}),
          },
        });
    }
    for (const rule of customRules ?? []) {
      const override =
        ruleConfig && Object.hasOwn(ruleConfig, rule.code)
          ? ruleConfig[rule.code]
          : undefined;
      if (override === "off") continue;
      for (const d of rule.check(clone(current)))
        diagnostics.push({
          ...d,
          severity: override ?? d.severity,
          location: {
            ...d.location,
            ...(path.length ? { path: JSON.stringify(path) } : {}),
          },
        });
    }
  }
  let raw: ReturnType<typeof toPatchObject> | undefined;
  try {
    raw = toPatchObject(patch, { skipValidation: true });
  } catch (e) {
    diagnostics.push({
      severity: "error",
      code: "S001",
      message: e instanceof Error ? e.message : String(e),
    });
  }
  if (raw) {
    function visit(
      patcher: NonNullable<typeof raw>["patcher"],
      path: string[],
    ): void {
      const current = normalize(path.length ? { patcher } : raw!);
      scope(current, path);
      for (const { box } of patcher.boxes)
        if (box.patcher) visit(box.patcher, [...path, box.id]);
    }
    visit(raw.patcher, []);
  }
  return { ok: !diagnostics.some((d) => d.severity === "error"), diagnostics };
};
