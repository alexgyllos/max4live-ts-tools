export class MaxpatParseError extends Error {
  readonly filePath: string;
  declare readonly cause?: unknown;

  constructor(message: string, filePath: string, cause?: unknown) {
    super(`${message} (${filePath})`);
    this.name = "MaxpatParseError";
    this.filePath = filePath;
    if (cause !== undefined) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}

export class MaxpatStructuralError extends Error {
  readonly filePath: string;
  readonly issues: unknown[];

  constructor(message: string, filePath: string, issues: unknown[]) {
    super(`${message} (${filePath})`);
    this.name = "MaxpatStructuralError";
    this.filePath = filePath;
    this.issues = issues;
  }
}

export class MaxpatValidationError extends Error {
  readonly diagnostics: unknown[];

  constructor(message: string, diagnostics: unknown[]) {
    super(message);
    this.name = "MaxpatValidationError";
    this.diagnostics = diagnostics;
  }
}

export class MaxpatWriteError extends Error {
  readonly code?: string;
  readonly filePath: string;
  declare readonly cause?: unknown;

  constructor(message: string, filePath: string, cause?: unknown) {
    super(`${message} (${filePath})`);
    this.name = "MaxpatWriteError";
    this.filePath = filePath;
    if (
      cause &&
      typeof cause === "object" &&
      "code" in cause &&
      typeof cause.code === "string"
    )
      this.code = cause.code;
    if (cause !== undefined) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}

export class MaxpatEditError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "MaxpatEditError";
    this.code = code;
  }
}
