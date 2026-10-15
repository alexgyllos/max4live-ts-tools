export type Rect = readonly [number, number, number, number];
export type PatchlineEndpoint = readonly [string, number];

export type Severity = "error" | "warning" | "info";

export type DiagnosticLocation = {
  boxId?: string;
  lineIndex?: number;
  sourceId?: string;
  destId?: string;
  path?: string;
};

export type Diagnostic = {
  severity: Severity;
  code: string;
  message: string;
  location?: DiagnosticLocation;
};

export type ValidationResult = {
  ok: boolean;
  diagnostics: Diagnostic[];
};

export type PatcherMeta = {
  rect?: Rect;
  appversion?: unknown;
  passthrough: Record<string, unknown>;
};

export type NormalizedBox = {
  id: string;
  maxclass: string;
  numinlets: number;
  numoutlets: number;
  patchingRect: Rect;
  passthrough: Record<string, unknown>;
  wrapperPassthrough?: Record<string, unknown>;
};

export type NormalizedLine = {
  sourceId: string;
  sourceOutlet: number;
  destId: string;
  destInlet: number;
  passthrough: Record<string, unknown>;
  wrapperPassthrough?: Record<string, unknown>;
};

export type NormalizedPatch = {
  rootPassthrough?: Record<string, unknown>;
  linesPresent?: boolean;
  patcherMeta: PatcherMeta;
  boxes: Map<string, NormalizedBox>;
  lines: NormalizedLine[];
  boxOrder: string[];
  /** IDs that appeared more than once in the source; populated by normalize(). */
  duplicateBoxIds: readonly string[];
};

export type RuleOverride = Severity | "off";
export type RuleConfig = Partial<Record<string, RuleOverride>>;

export type CustomRule = {
  code: string;
  check: (patch: NormalizedPatch) => Diagnostic[];
};

export type ReadOptions = {
  validateGraph?: boolean;
  ruleConfig?: RuleConfig;
  customRules?: CustomRule[];
};

export type WriteOptions = {
  /** File writers only: false atomically refuses an existing destination. Default true. */
  overwrite?: boolean;
  /** Skips graph rules only; structural validation can never be skipped. */
  skipValidation?: boolean;
  ruleConfig?: RuleConfig;
  customRules?: CustomRule[];
};

export type BoxSpec = {
  maxclass: string;
  numinlets: number;
  numoutlets: number;
  patchingRect: Rect;
  passthrough?: Record<string, unknown>;
};

export type BoxUpdate = {
  maxclass?: string;
  numinlets?: number;
  numoutlets?: number;
  patchingRect?: Rect;
  passthrough?: Record<string, unknown>;
};
