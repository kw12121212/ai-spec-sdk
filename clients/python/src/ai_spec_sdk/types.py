# AUTO-GENERATED from bridge-contract.yaml
# Do not edit manually. Run type generator to regenerate.
# Generated at: 2026-04-10T09:35:43.261Z

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

# ── Common ──────────────────────────────────────────────────────────────────

@dataclass
class JsonRpcRequest:
    jsonrpc: Literal["2.0"]
    id: str | int | None
    method: str
    params: dict[str, Any] | None = None

@dataclass
class JsonRpcResponse:
    jsonrpc: Literal["2.0"]
    id: str | int | None
    result: Any | None = None
    error: JsonRpcError | None = None

@dataclass
class JsonRpcNotification:
    jsonrpc: Literal["2.0"]
    method: str
    params: dict[str, Any]

# ── Method Params ────────────────────────────────────────────────────────────

@dataclass
class BridgeNegotiateVersionParams:
    supportedVersions: list[Any] = field(default_factory=list)

@dataclass
class WorkflowRunParams:
    workspace: str
    workflow: Literal["init", "propose", "modify", "apply", "verify", "archive", "cancel", "list"]
    args: list[Any] | None = None

@dataclass
class SessionStartParams:
    workspace: str
    prompt: str
    options: dict[str, Any] | None = None

@dataclass
class SessionResumeParams:
    sessionId: str
    prompt: str
    options: dict[str, Any] | None = None

@dataclass
class SessionStopParams:
    sessionId: str

@dataclass
class SessionStatusParams:
    sessionId: str

# ── Method Results ───────────────────────────────────────────────────────────

@dataclass
class BridgeCapabilitiesResult:
    protocol: str
    transport: Literal["stdio", "http"]
    bridgeVersion: str
    apiVersion: str
    notifications: dict[str, Any] = field(default_factory=dict)
    workflows: Literal["init", "propose", "modify", "apply", "verify", "archive", "cancel", "list"] = field(default_factory=list)
    skills: Literal["spec-driven-brainstorm", "spec-driven-init", "spec-driven-propose", "spec-driven-modify", "spec-driven-spec-content", "spec-driven-apply", "spec-driven-verify", "spec-driven-review", "spec-driven-archive", "spec-driven-cancel", "spec-driven-auto"] = field(default_factory=list)
    workflowSkillMap: dict[str, Any]
    methods: list[Any] = field(default_factory=list)

@dataclass
class BridgeNegotiateVersionResult:
    negotiatedVersion: str
    capabilities: dict[str, Any]

@dataclass
class SkillsListResult:
    skills: list[Any] = field(default_factory=list)

@dataclass
class WorkflowRunResult:
    workflow: str
    workspace: str
    stdout: str
    stderr: str
    parsed: Any

@dataclass
class SessionStartResult:
    sessionId: str
    status: Literal["completed", "stopped", "interrupted"]
    result: Any | None = None

@dataclass
class SessionResumeResult:
    sessionId: str
    status: Literal["completed", "stopped", "interrupted"]
    result: Any | None = None

@dataclass
class SessionStopResult:
    sessionId: str
    status: Literal["stopped"]

@dataclass
class SessionStatusResult:
    sessionId: str
    status: Literal["active", "completed", "stopped", "interrupted"]
    createdAt: str
    updatedAt: str
    historyLength: int | float
    result: Any | None = None

# ── Error Types ──────────────────────────────────────────────────────────────

@dataclass
class JsonRpcError:
    code: int
    message: str
    data: Any | None = None

@dataclass
class InternalErrorErrorData:
    message: str

@dataclass
class WorkspaceNotFoundErrorData:
    workspace: str

@dataclass
class ScriptNotFoundErrorData:
    scriptPath: str

@dataclass
class WorkflowFailedErrorData:
    workflow: str
    workspace: str
    message: str
    stdout: str
    stderr: str
    code: Any

@dataclass
class SessionNotFoundErrorData:
    sessionId: str

@dataclass
class SDKUnavailableErrorData:
    hint: str

@dataclass
class VersionMismatchErrorData:
    supportedVersions: list[Any] = field(default_factory=list)

# ── Notification Types ───────────────────────────────────────────────────────

NotificationMethod = Literal[
]
