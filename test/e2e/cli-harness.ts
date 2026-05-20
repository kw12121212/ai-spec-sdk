import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const COMPILED_CLI_PATH = path.resolve(PROJECT_ROOT, "dist/src/cli.js");
const DEFAULT_TIMEOUT_MS = 20_000;
const CLI_RUNTIME = "bun";
const CLI_RUNTIME_ARGS = ["run"];

let ptySupport: boolean | null = null;

type OutputMatcher = string | RegExp | ((output: string) => boolean);

export interface CliE2EContext {
  rootDir: string;
  homeDir: string;
  workspaceDir: string;
  cliPath: string;
  env: NodeJS.ProcessEnv;
  cleanup: () => void;
}

export interface CliRunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
}

export interface RunningCliProcess {
  readonly pid: number | undefined;
  readonly result: Promise<CliRunResult>;
  stdout: () => string;
  stderr: () => string;
  write: (input: string) => void;
  end: (input?: string) => void;
  waitForStdoutMatch: (matcher: OutputMatcher, timeoutMs?: number) => Promise<string>;
  stop: (signal?: NodeJS.Signals) => Promise<CliRunResult>;
}

interface ProcessOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}

interface TrackedChildProcess {
  readonly pid: number | undefined;
  readonly stdin: NodeJS.WritableStream | null;
  readonly stdout: NodeJS.ReadableStream;
  readonly stderr: NodeJS.ReadableStream;
  once(event: "error", listener: (error: Error) => void): this;
  once(
    event: "exit",
    listener: (exitCode: number | null, signal: NodeJS.Signals | null) => void,
  ): this;
  kill(signal?: NodeJS.Signals): boolean;
}

function ensureCompiledCli(): string {
  if (!existsSync(COMPILED_CLI_PATH)) {
    execFileSync("bun", ["run", "build"], {
      cwd: PROJECT_ROOT,
      stdio: "inherit",
    });
  }
  return COMPILED_CLI_PATH;
}

function outputMatches(output: string, matcher: OutputMatcher): boolean {
  if (typeof matcher === "string") {
    return output.includes(matcher);
  }
  if (matcher instanceof RegExp) {
    return matcher.test(output);
  }
  return matcher(output);
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function shellCommand(command: string, args: string[]): string {
  return [command, ...args].map(shellQuote).join(" ");
}

function trackProcess(
  child: TrackedChildProcess,
  timeoutMs: number,
): RunningCliProcess {
  let stdout = "";
  let stderr = "";
  let finished = false;
  let timedOut = false;

  const waiters = new Set<() => void>();
  const notifyWaiters = () => {
    for (const waiter of [...waiters]) {
      waiter();
    }
  };

  child.stdout.on("data", (chunk: Buffer | string) => {
    stdout += chunk.toString();
    notifyWaiters();
  });
  child.stderr.on("data", (chunk: Buffer | string) => {
    stderr += chunk.toString();
    notifyWaiters();
  });

  const result = new Promise<CliRunResult>((resolve, reject) => {
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.once("exit", (exitCode, signal) => {
      clearTimeout(timer);
      finished = true;
      notifyWaiters();
      resolve({
        stdout,
        stderr,
        exitCode,
        signal,
        timedOut,
      });
    });
  });

  const waitForStdoutMatch = (matcher: OutputMatcher, waitTimeoutMs = DEFAULT_TIMEOUT_MS): Promise<string> => {
    if (outputMatches(stdout, matcher)) {
      return Promise.resolve(stdout);
    }

    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        waiters.delete(check);
        reject(new Error(`Timed out waiting for stdout match. Current stdout:\n${stdout}`));
      }, waitTimeoutMs);

      const check = () => {
        if (outputMatches(stdout, matcher)) {
          clearTimeout(timer);
          waiters.delete(check);
          resolve(stdout);
          return;
        }
        if (finished) {
          clearTimeout(timer);
          waiters.delete(check);
          reject(new Error(`Process exited before stdout matched. Current stdout:\n${stdout}\nCurrent stderr:\n${stderr}`));
        }
      };

      waiters.add(check);
    });
  };

  return {
    pid: child.pid,
    result,
    stdout: () => stdout,
    stderr: () => stderr,
    write: (input: string) => {
      if (!child.stdin) {
        throw new Error("stdin is unavailable for this process");
      }
      child.stdin.write(input);
    },
    end: (input?: string) => {
      if (!child.stdin) {
        throw new Error("stdin is unavailable for this process");
      }
      if (input !== undefined) {
        child.stdin.write(input);
      }
      child.stdin.end();
    },
    waitForStdoutMatch,
    stop: async (signal = "SIGTERM") => {
      child.kill(signal);
      return result;
    },
  };
}

export function createCliE2EContext(): CliE2EContext {
  const cliPath = ensureCompiledCli();
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "ai-spec-cli-e2e-"));
  const homeDir = path.join(rootDir, "home");
  const workspaceDir = path.join(rootDir, "workspace");

  mkdirSync(homeDir, { recursive: true });
  mkdirSync(workspaceDir, { recursive: true });

  return {
    rootDir,
    homeDir,
    workspaceDir,
    cliPath,
    env: {
      ...process.env,
      HOME: homeDir,
      USERPROFILE: homeDir,
    },
    cleanup: () => {
      rmSync(rootDir, { recursive: true, force: true });
    },
  };
}

export function startCliPipe(
  context: CliE2EContext,
  args: string[],
  options: ProcessOptions = {},
): RunningCliProcess {
  const child = spawn(CLI_RUNTIME, [...CLI_RUNTIME_ARGS, context.cliPath, ...args], {
    cwd: options.cwd ?? context.workspaceDir,
    env: { ...context.env, ...options.env },
    stdio: ["pipe", "pipe", "pipe"],
  });

  return trackProcess(child, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
}

export async function runCliPipe(
  context: CliE2EContext,
  args: string[],
  options: ProcessOptions & { input?: string } = {},
): Promise<CliRunResult> {
  const running = startCliPipe(context, args, options);
  if (options.input !== undefined) {
    running.end(options.input);
  }
  return running.result;
}

export function supportsPtyHarness(): boolean {
  if (ptySupport !== null) {
    return ptySupport;
  }

  if (process.platform !== "linux") {
    ptySupport = false;
    return ptySupport;
  }

  const probe = spawnSync("script", ["-qefc", "printf pty-ready", "/dev/null"], {
    encoding: "utf8",
  });

  ptySupport = !probe.error && probe.status === 0 && probe.stdout.includes("pty-ready");
  return ptySupport;
}

export async function runCliPty(
  context: CliE2EContext,
  args: string[],
  options: ProcessOptions = {},
): Promise<CliRunResult> {
  if (!supportsPtyHarness()) {
    throw new Error("PTY harness support is unavailable on this platform");
  }

  const child = spawn(
    "script",
    ["-qefc", shellCommand(CLI_RUNTIME, [...CLI_RUNTIME_ARGS, context.cliPath, ...args]), "/dev/null"],
    {
      cwd: options.cwd ?? context.workspaceDir,
      env: { ...context.env, ...options.env },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  return trackProcess(child, options.timeoutMs ?? DEFAULT_TIMEOUT_MS).result;
}

export async function allocatePort(): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Failed to allocate a TCP port"));
        return;
      }

      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}
