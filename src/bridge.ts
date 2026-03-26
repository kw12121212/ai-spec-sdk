import path from "node:path";
import fs from "node:fs";
import { BridgeError, isJsonRpcRequest } from "./errors.js";
import { getCapabilities, BUILTIN_SPEC_SKILLS } from "./capabilities.js";
import { runWorkflow } from "./workflow.js";
import { SessionStore } from "./session-store.js";
import { runClaudeQuery } from "./claude-agent-runner.js";

const METHOD_NOT_FOUND = -32601;
const INTERNAL_ERROR = -32603;

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: unknown;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: unknown;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface BridgeServerOptions {
  notify?: (message: unknown) => void;
}

export class BridgeServer {
  private notify: (message: unknown) => void;
  private sessionStore: SessionStore;

  constructor({ notify = () => {} }: BridgeServerOptions = {}) {
    this.notify = notify;
    this.sessionStore = new SessionStore();
  }

  async handleMessage(payload: unknown): Promise<JsonRpcResponse> {
    const id =
      payload !== null &&
      typeof payload === "object" &&
      Object.prototype.hasOwnProperty.call(payload, "id")
        ? (payload as Record<string, unknown>)["id"]
        : null;

    if (!isJsonRpcRequest(payload)) {
      return {
        jsonrpc: "2.0",
        id,
        error: new BridgeError(-32600, "Invalid JSON-RPC request").toJsonRpcError(),
      };
    }

    const request = payload as JsonRpcRequest;

    try {
      const result = await this.dispatch(request.method, request.params ?? {}, request.id);
      return {
        jsonrpc: "2.0",
        id,
        result,
      };
    } catch (error) {
      const bridgeError =
        error instanceof BridgeError
          ? error
          : new BridgeError(INTERNAL_ERROR, "Internal bridge error", {
              message: (error as Error).message,
            });

      return {
        jsonrpc: "2.0",
        id,
        error: bridgeError.toJsonRpcError(),
      };
    }
  }

  private async dispatch(
    method: string,
    params: Record<string, unknown>,
    requestId: unknown,
  ): Promise<unknown> {
    switch (method) {
      case "bridge.capabilities":
        return getCapabilities();
      case "skills.list":
        return { skills: BUILTIN_SPEC_SKILLS };
      case "workflow.run":
        return runWorkflow(
          params as { workspace: unknown; workflow: unknown; args?: unknown[] },
          (event, payload) => {
            this.emit(event, payload, requestId);
          },
        );
      case "session.start":
        return this.startSession(params, requestId);
      case "session.resume":
        return this.resumeSession(params, requestId);
      case "session.stop":
        return this.stopSession(params);
      case "session.status":
        return this.getSessionStatus(params);
      default:
        throw new BridgeError(METHOD_NOT_FOUND, `Method not found: ${method}`);
    }
  }

  private emit(method: string, params: Record<string, unknown>, requestId: unknown = null): void {
    this.notify({
      jsonrpc: "2.0",
      method,
      params: {
        ...params,
        requestId,
      },
    });
  }

  private async startSession(
    params: Record<string, unknown>,
    requestId: unknown,
  ): Promise<unknown> {
    const { workspace, prompt, options = {} } = params;

    if (!workspace || typeof workspace !== "string") {
      throw new BridgeError(-32602, "'workspace' must be provided");
    }

    if (!prompt || typeof prompt !== "string") {
      throw new BridgeError(-32602, "'prompt' must be provided");
    }

    const resolvedWorkspace = path.resolve(workspace);
    if (!fs.existsSync(resolvedWorkspace) || !fs.statSync(resolvedWorkspace).isDirectory()) {
      throw new BridgeError(-32001, "Workspace path does not exist", {
        workspace: resolvedWorkspace,
      });
    }

    const session = this.sessionStore.create(resolvedWorkspace, prompt);

    this.emit(
      "bridge/session_event",
      { sessionId: session.id, type: "session_started" },
      requestId,
    );

    return this._runQuery(
      session,
      prompt,
      options as Record<string, unknown>,
      requestId,
    );
  }

  private async resumeSession(
    params: Record<string, unknown>,
    requestId: unknown,
  ): Promise<unknown> {
    const { sessionId, prompt, options = {} } = params;

    if (!sessionId || typeof sessionId !== "string") {
      throw new BridgeError(-32602, "'sessionId' must be provided");
    }

    const session = this.sessionStore.get(sessionId);
    if (!session) {
      throw new BridgeError(-32011, "Session not found", { sessionId });
    }

    if (!prompt || typeof prompt !== "string") {
      throw new BridgeError(-32602, "'prompt' must be provided");
    }

    this.sessionStore.appendEvent(session.id, { type: "resume_prompt", prompt });

    this.emit(
      "bridge/session_event",
      { sessionId: session.id, type: "session_resumed" },
      requestId,
    );

    return this._runQuery(
      session,
      prompt,
      { ...(options as Record<string, unknown>), resume: session.id },
      requestId,
    );
  }

  private async _runQuery(
    session: { id: string },
    prompt: string,
    options: Record<string, unknown>,
    requestId: unknown,
  ): Promise<unknown> {
    const queryResult = await runClaudeQuery({
      prompt,
      options,
      shouldStop: () => {
        const current = this.sessionStore.get(session.id);
        return Boolean(current?.stopRequested);
      },
      onEvent: (message) => {
        const current = this.sessionStore.get(session.id);
        if (current?.stopRequested) {
          return;
        }

        this.sessionStore.appendEvent(session.id, {
          type: "agent_message",
          message,
        });

        this.emit(
          "bridge/session_event",
          { sessionId: session.id, type: "agent_message", message },
          requestId,
        );
      },
    });

    if (queryResult.status === "stopped") {
      const stopped = this.sessionStore.stop(session.id);
      this.emit(
        "bridge/session_event",
        {
          sessionId: session.id,
          type: "session_stopped",
          status: stopped ? stopped.status : "stopped",
        },
        requestId,
      );

      return { sessionId: session.id, status: "stopped", result: null };
    }

    this.sessionStore.complete(session.id, queryResult.result);

    this.emit(
      "bridge/session_event",
      { sessionId: session.id, type: "session_completed", result: queryResult.result },
      requestId,
    );

    return { sessionId: session.id, status: "completed", result: queryResult.result };
  }

  private stopSession(params: Record<string, unknown>): unknown {
    const { sessionId } = params;
    if (!sessionId || typeof sessionId !== "string") {
      throw new BridgeError(-32602, "'sessionId' must be provided");
    }

    const session = this.sessionStore.stop(sessionId);
    if (!session) {
      throw new BridgeError(-32011, "Session not found", { sessionId });
    }

    return { sessionId, status: session.status };
  }

  private getSessionStatus(params: Record<string, unknown>): unknown {
    const { sessionId } = params;
    if (!sessionId || typeof sessionId !== "string") {
      throw new BridgeError(-32602, "'sessionId' must be provided");
    }

    const session = this.sessionStore.get(sessionId);
    if (!session) {
      throw new BridgeError(-32011, "Session not found", { sessionId });
    }

    return {
      sessionId,
      status: session.status,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      historyLength: session.history.length,
      result: session.result,
    };
  }
}
