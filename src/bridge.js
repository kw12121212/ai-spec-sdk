import path from "node:path";
import fs from "node:fs";
import { BridgeError, isJsonRpcRequest } from "./errors.js";
import { getCapabilities, BUILTIN_SPEC_SKILLS } from "./capabilities.js";
import { runWorkflow } from "./workflow.js";
import { SessionStore } from "./session-store.js";
import { runClaudeQuery } from "./claude-agent-runner.js";

const METHOD_NOT_FOUND = -32601;
const INTERNAL_ERROR = -32603;

export class BridgeServer {
  constructor({ notify = () => {} } = {}) {
    this.notify = notify;
    this.sessionStore = new SessionStore();
  }

  async handleMessage(payload) {
    const id =
      payload && typeof payload === "object" && Object.prototype.hasOwnProperty.call(payload, "id")
        ? payload.id
        : null;

    if (!isJsonRpcRequest(payload)) {
      return {
        jsonrpc: "2.0",
        id,
        error: new BridgeError(-32600, "Invalid JSON-RPC request").toJsonRpcError(),
      };
    }

    try {
      const result = await this.dispatch(payload.method, payload.params || {}, id);
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
              message: error.message,
            });

      return {
        jsonrpc: "2.0",
        id,
        error: bridgeError.toJsonRpcError(),
      };
    }
  }

  async dispatch(method, params, requestId) {
    switch (method) {
      case "bridge.capabilities":
        return getCapabilities();
      case "skills.list":
        return {
          skills: BUILTIN_SPEC_SKILLS,
        };
      case "workflow.run":
        return runWorkflow(params, (event, payload) => {
          this.emit(event, payload, requestId);
        });
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

  emit(method, params, requestId = null) {
    this.notify({
      jsonrpc: "2.0",
      method,
      params: {
        ...params,
        requestId,
      },
    });
  }

  async startSession(params, requestId) {
    const { workspace, prompt, options = {} } = params || {};

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
      {
        sessionId: session.id,
        type: "session_started",
      },
      requestId,
    );

    const queryResult = await runClaudeQuery({
      prompt,
      options,
      shouldStop: () => {
        const current = this.sessionStore.get(session.id);
        return Boolean(current && current.stopRequested);
      },
      onEvent: (message) => {
        const current = this.sessionStore.get(session.id);
        if (current && current.stopRequested) {
          return;
        }

        this.sessionStore.appendEvent(session.id, {
          type: "agent_message",
          message,
        });

        this.emit(
          "bridge/session_event",
          {
            sessionId: session.id,
            type: "agent_message",
            message,
          },
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

      return {
        sessionId: session.id,
        status: "stopped",
        result: null,
      };
    }

    this.sessionStore.complete(session.id, queryResult.result);

    this.emit(
      "bridge/session_event",
      {
        sessionId: session.id,
        type: "session_completed",
        result: queryResult.result,
      },
      requestId,
    );

    return {
      sessionId: session.id,
      status: "completed",
      result: queryResult.result,
    };
  }

  async resumeSession(params, requestId) {
    const { sessionId, prompt, options = {} } = params || {};

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

    this.sessionStore.appendEvent(session.id, {
      type: "resume_prompt",
      prompt,
    });

    this.emit(
      "bridge/session_event",
      {
        sessionId: session.id,
        type: "session_resumed",
      },
      requestId,
    );

    const queryResult = await runClaudeQuery({
      prompt,
      options: {
        ...options,
        resume: session.id,
      },
      shouldStop: () => {
        const current = this.sessionStore.get(session.id);
        return Boolean(current && current.stopRequested);
      },
      onEvent: (message) => {
        const current = this.sessionStore.get(session.id);
        if (current && current.stopRequested) {
          return;
        }

        this.sessionStore.appendEvent(session.id, {
          type: "agent_message",
          message,
        });

        this.emit(
          "bridge/session_event",
          {
            sessionId: session.id,
            type: "agent_message",
            message,
          },
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

      return {
        sessionId: session.id,
        status: "stopped",
        result: null,
      };
    }

    this.sessionStore.complete(session.id, queryResult.result);

    this.emit(
      "bridge/session_event",
      {
        sessionId: session.id,
        type: "session_completed",
        result: queryResult.result,
      },
      requestId,
    );

    return {
      sessionId: session.id,
      status: "completed",
      result: queryResult.result,
    };
  }

  stopSession(params) {
    const { sessionId } = params || {};
    if (!sessionId || typeof sessionId !== "string") {
      throw new BridgeError(-32602, "'sessionId' must be provided");
    }

    const session = this.sessionStore.stop(sessionId);
    if (!session) {
      throw new BridgeError(-32011, "Session not found", { sessionId });
    }

    return {
      sessionId,
      status: session.status,
    };
  }

  getSessionStatus(params) {
    const { sessionId } = params || {};
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
