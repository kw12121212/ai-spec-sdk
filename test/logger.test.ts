import { describe, it, expect } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Logger, VALID_LOG_LEVELS } from "../src/logger.js";

function capture(): { lines: string[]; output: (line: string) => void } {
  const lines: string[] = [];
  return {
    lines,
    output: (line: string) => { lines.push(line); },
  };
}

describe("Logger", () => {
  it("filters messages below current level", () => {
    const { lines, output } = capture();
    const log = new Logger("warn", {}, output);

    log.trace("should not appear");
    log.debug("should not appear");
    log.info("should not appear");
    log.warn("should appear");
    log.error("should also appear");

    expect(lines.length).toBe(2);
  });

  it("outputs valid JSON with required fields", () => {
    const { lines, output } = capture();
    const log = new Logger("trace", {}, output);

    log.info("test message");

    expect(lines.length).toBe(1);
    const parsed = JSON.parse(lines[0]!);
    expect(parsed.level).toBe("info");
    expect(parsed.message).toBe("test message");
    expect(typeof parsed.timestamp).toBe("string");
  });

  it("includes extra bindings in output", () => {
    const { lines, output } = capture();
    const log = new Logger("debug", {}, output);

    log.debug("hello", { sessionId: "abc-123", durationMs: 42 });

    const parsed = JSON.parse(lines[0]!);
    expect(parsed.sessionId).toBe("abc-123");
    expect(parsed.durationMs).toBe(42);
  });

  it("child logger propagates context bindings", () => {
    const { lines, output } = capture();
    const parent = new Logger("debug", { requestId: "req-1" }, output);
    const child = parent.child({ sessionId: "sess-1" });

    child.info("child message");

    const parsed = JSON.parse(lines[0]!);
    expect(parsed.requestId).toBe("req-1");
    expect(parsed.sessionId).toBe("sess-1");
  });

  it("setLevel changes filtering at runtime", () => {
    const { lines, output } = capture();
    const log = new Logger("error", {}, output);

    log.info("before");
    expect(lines.length).toBe(0);

    log.setLevel("info");
    log.info("after");
    expect(lines.length).toBe(1);

    const parsed = JSON.parse(lines[0]!);
    expect(parsed.message).toBe("after");
  });

  it("getLevel returns current level", () => {
    const log = new Logger("debug");
    expect(log.getLevel()).toBe("debug");

    log.setLevel("error");
    expect(log.getLevel()).toBe("error");
  });

  it("VALID_LOG_LEVELS contains all five levels", () => {
    expect(VALID_LOG_LEVELS).toEqual(new Set(["trace", "debug", "info", "warn", "error"]));
  });

  it("defaults to info level when constructed without arguments", () => {
    const log = new Logger(undefined, {}, () => {});
    expect(log.getLevel()).toBe("info");
  });

  it("writes to file when logFile is set", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "logger-file-"));
    const logPath = path.join(tmpDir, "test.log");
    try {
      const log = new Logger("debug", {}, undefined, logPath);
      log.info("file test", { key: "value" });

      // Wait for write stream to flush
      await new Promise((r) => setTimeout(r, 50));

      const content = fs.readFileSync(logPath, "utf8").trim();
      expect(content.length).toBeGreaterThan(0);
      const parsed = JSON.parse(content);
      expect(parsed.message).toBe("file test");
      expect(parsed.key).toBe("value");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("does not create file when logFile is not set", () => {
    const { lines, output } = capture();
    const log = new Logger("debug", {}, output);
    log.info("no file");

    expect(lines.length).toBe(1);
  });
});
