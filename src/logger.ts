import fs from "node:fs";

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
};

export const VALID_LOG_LEVELS = new Set<string>(Object.keys(LEVEL_ORDER));

function parseLevel(raw: string | undefined): LogLevel {
  if (!raw) return "info";
  const lower = raw.toLowerCase();
  if (lower in LEVEL_ORDER) return lower as LogLevel;
  return "info";
}

export type LogBindings = Record<string, unknown>;

function makeOutput(logFile?: string): (line: string) => void {
  if (!logFile) {
    return (line: string) => { process.stderr.write(line + "\n"); };
  }
  const stream = fs.createWriteStream(logFile, { flags: "a" });
  return (line: string) => {
    process.stderr.write(line + "\n");
    stream.write(line + "\n");
  };
}

export class Logger {
  private level: LogLevel;
  private bindings: LogBindings;
  private output: (line: string) => void;

  constructor(
    level?: LogLevel,
    bindings?: LogBindings,
    output?: (line: string) => void,
    logFile?: string,
  ) {
    this.level = level ?? parseLevel(process.env["AI_SPEC_SDK_LOG_LEVEL"]);
    this.bindings = bindings ?? {};
    const file = logFile ?? process.env["AI_SPEC_SDK_LOG_FILE"];
    this.output = output ?? makeOutput(file || undefined);
  }

  child(bindings: LogBindings): Logger {
    return new Logger(
      this.level,
      { ...this.bindings, ...bindings },
      this.output,
    );
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  trace(message: string, extra?: LogBindings): void {
    this._log("trace", message, extra);
  }

  debug(message: string, extra?: LogBindings): void {
    this._log("debug", message, extra);
  }

  info(message: string, extra?: LogBindings): void {
    this._log("info", message, extra);
  }

  warn(message: string, extra?: LogBindings): void {
    this._log("warn", message, extra);
  }

  error(message: string, extra?: LogBindings): void {
    this._log("error", message, extra);
  }

  private _log(level: LogLevel, message: string, extra?: LogBindings): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.level]) return;

    const entry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.bindings,
      ...extra,
    };

    this.output(JSON.stringify(entry));
  }
}

export const defaultLogger = new Logger(undefined, undefined, undefined, process.env["AI_SPEC_SDK_LOG_FILE"]);
