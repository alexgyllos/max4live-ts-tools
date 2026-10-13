import type { NormalizedPatch, Diagnostic, Severity } from "../types.js";

type RuleFn = (patch: NormalizedPatch) => Diagnostic[];

type BuiltinRule = {
  code: string;
  defaultSeverity: Severity;
  check: RuleFn;
};

const duplicateBoxIds: RuleFn = (patch) => {
  const diagnostics: Diagnostic[] = [];
  for (const id of patch.duplicateBoxIds) {
    diagnostics.push({
      severity: "error",
      code: "E001",
      message: `duplicate box id "${id}"`,
      location: { boxId: id },
    });
  }
  return diagnostics;
};

const missingSource: RuleFn = (patch) => {
  const diagnostics: Diagnostic[] = [];
  patch.lines.forEach((line, idx) => {
    if (!patch.boxes.has(line.sourceId)) {
      diagnostics.push({
        severity: "error",
        code: "E002",
        message: `source box "${line.sourceId}" does not exist`,
        location: { lineIndex: idx, sourceId: line.sourceId },
      });
    }
  });
  return diagnostics;
};

const missingDestination: RuleFn = (patch) => {
  const diagnostics: Diagnostic[] = [];
  patch.lines.forEach((line, idx) => {
    if (!patch.boxes.has(line.destId)) {
      diagnostics.push({
        severity: "error",
        code: "E003",
        message: `destination box "${line.destId}" does not exist`,
        location: { lineIndex: idx, destId: line.destId },
      });
    }
  });
  return diagnostics;
};

const sourceOutletOutOfBounds: RuleFn = (patch) => {
  const diagnostics: Diagnostic[] = [];
  patch.lines.forEach((line, idx) => {
    const box = patch.boxes.get(line.sourceId);
    if (box === undefined) return; // E002 handles missing box
    if (line.sourceOutlet >= box.numoutlets) {
      diagnostics.push({
        severity: "error",
        code: "E004",
        message: `source outlet ${line.sourceOutlet} out of bounds for box "${line.sourceId}" (numoutlets=${box.numoutlets})`,
        location: { lineIndex: idx, sourceId: line.sourceId },
      });
    }
  });
  return diagnostics;
};

const destInletOutOfBounds: RuleFn = (patch) => {
  const diagnostics: Diagnostic[] = [];
  patch.lines.forEach((line, idx) => {
    const box = patch.boxes.get(line.destId);
    if (box === undefined) return; // E003 handles missing box
    if (line.destInlet >= box.numinlets) {
      diagnostics.push({
        severity: "error",
        code: "E005",
        message: `destination inlet ${line.destInlet} out of bounds for box "${line.destId}" (numinlets=${box.numinlets})`,
        location: { lineIndex: idx, destId: line.destId },
      });
    }
  });
  return diagnostics;
};

const malformedPatchingRect: RuleFn = (patch) => {
  const diagnostics: Diagnostic[] = [];
  for (const [id, box] of patch.boxes) {
    const r = box.patchingRect;
    if (
      !Array.isArray(r) ||
      r.length !== 4 ||
      (r as unknown[]).some(
        (n) => typeof n !== "number" || !isFinite(n as number),
      )
    ) {
      diagnostics.push({
        severity: "error",
        code: "E006",
        message: `box "${id}" has malformed patching_rect`,
        location: { boxId: id },
      });
    }
  }
  return diagnostics;
};

const malformedEndpoint: RuleFn = (patch) => {
  const diagnostics: Diagnostic[] = [];
  patch.lines.forEach((line, idx) => {
    const srcOk =
      typeof line.sourceId === "string" &&
      Number.isSafeInteger(line.sourceOutlet) &&
      line.sourceOutlet >= 0;
    const dstOk =
      typeof line.destId === "string" &&
      Number.isSafeInteger(line.destInlet) &&
      line.destInlet >= 0;
    if (!srcOk || !dstOk) {
      diagnostics.push({
        severity: "error",
        code: "E007",
        message: `line ${idx} has malformed endpoint`,
        location: { lineIndex: idx },
      });
    }
  });
  return diagnostics;
};

const duplicatePatchline: RuleFn = (patch) => {
  const seen = new Map<string, number>();
  const diagnostics: Diagnostic[] = [];
  patch.lines.forEach((line, idx) => {
    const key = JSON.stringify([
      line.sourceId,
      line.sourceOutlet,
      line.destId,
      line.destInlet,
    ]);
    if (seen.has(key)) {
      diagnostics.push({
        severity: "warning",
        code: "W001",
        message: `duplicate patchline ${line.sourceId}:${line.sourceOutlet} -> ${line.destId}:${line.destInlet}`,
        location: {
          lineIndex: idx,
          sourceId: line.sourceId,
          destId: line.destId,
        },
      });
    } else {
      seen.set(key, idx);
    }
  });
  return diagnostics;
};

const orphanBox: RuleFn = (patch) => {
  const connected = new Set<string>();
  for (const line of patch.lines) {
    connected.add(line.sourceId);
    connected.add(line.destId);
  }
  const diagnostics: Diagnostic[] = [];
  for (const [id] of patch.boxes) {
    if (!connected.has(id)) {
      diagnostics.push({
        severity: "info",
        code: "I001",
        message: `box "${id}" has no connections`,
        location: { boxId: id },
      });
    }
  }
  return diagnostics;
};

export const BUILTIN_RULES: readonly BuiltinRule[] = [
  { code: "E001", defaultSeverity: "error", check: duplicateBoxIds },
  { code: "E002", defaultSeverity: "error", check: missingSource },
  { code: "E003", defaultSeverity: "error", check: missingDestination },
  { code: "E004", defaultSeverity: "error", check: sourceOutletOutOfBounds },
  { code: "E005", defaultSeverity: "error", check: destInletOutOfBounds },
  { code: "E006", defaultSeverity: "error", check: malformedPatchingRect },
  { code: "E007", defaultSeverity: "error", check: malformedEndpoint },
  { code: "W001", defaultSeverity: "warning", check: duplicatePatchline },
  { code: "I001", defaultSeverity: "info", check: orphanBox },
];
