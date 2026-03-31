"""Typed dataclasses for ai-spec-sdk request/response parameters."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal


# ── Session params ──────────────────────────────────────────────────────


@dataclass
class SessionStartParams:
    workspace: str
    prompt: str
    model: str | None = None
    allowedTools: list[str] | None = None
    disallowedTools: list[str] | None = None
    permissionMode: str | None = None
    maxTurns: int | None = None
    systemPrompt: str | None = None
    stream: bool = False


@dataclass
class SessionResumeParams:
    sessionId: str
    prompt: str
    model: str | None = None
    allowedTools: list[str] | None = None
    disallowedTools: list[str] | None = None
    permissionMode: str | None = None
    maxTurns: int | None = None
    systemPrompt: str | None = None
    stream: bool = False


@dataclass
class SessionStopParams:
    sessionId: str


@dataclass
class SessionStatusParams:
    sessionId: str


@dataclass
class SessionListParams:
    status: str | None = None


@dataclass
class SessionHistoryParams:
    sessionId: str
    offset: int = 0
    limit: int = 100


@dataclass
class SessionEventsParams:
    sessionId: str
    since: int = 0
    limit: int = 50


@dataclass
class SessionExportParams:
    sessionId: str


@dataclass
class SessionDeleteParams:
    sessionId: str


@dataclass
class SessionCleanupParams:
    olderThanDays: int = 30


@dataclass
class SessionApproveToolParams:
    sessionId: str
    requestId: str


@dataclass
class SessionRejectToolParams:
    sessionId: str
    requestId: str
    message: str | None = None


@dataclass
class SessionBranchParams:
    sessionId: str
    fromIndex: int | None = None
    prompt: str | None = None


@dataclass
class SessionSearchParams:
    query: str
    workspace: str | None = None
    status: str | None = None
    limit: int = 20


# ── Config params ───────────────────────────────────────────────────────


@dataclass
class ConfigGetParams:
    key: str
    workspace: str | None = None


@dataclass
class ConfigSetParams:
    key: str
    value: Any
    workspace: str | None = None
    scope: Literal["project", "user"] = "project"


@dataclass
class ConfigListParams:
    workspace: str | None = None


# ── MCP params ──────────────────────────────────────────────────────────


@dataclass
class McpAddParams:
    workspace: str
    name: str
    command: str
    args: list[str] = field(default_factory=list)
    env: dict[str, str] = field(default_factory=dict)


@dataclass
class McpRemoveParams:
    workspace: str
    name: str


@dataclass
class McpStartParams:
    workspace: str
    name: str


@dataclass
class McpStopParams:
    workspace: str
    name: str


@dataclass
class McpListParams:
    workspace: str


# ── Hooks params ────────────────────────────────────────────────────────


@dataclass
class HooksAddParams:
    event: str
    command: str
    matcher: str | None = None
    scope: Literal["project", "user"] = "project"
    workspace: str | None = None


@dataclass
class HooksRemoveParams:
    hookId: str


@dataclass
class HooksListParams:
    workspace: str | None = None


# ── Context params ──────────────────────────────────────────────────────


@dataclass
class ContextReadParams:
    scope: Literal["project", "user"]
    path: str
    workspace: str | None = None


@dataclass
class ContextWriteParams:
    scope: Literal["project", "user"]
    path: str
    content: str
    workspace: str | None = None


@dataclass
class ContextListParams:
    workspace: str | None = None


# ── Workspace params ────────────────────────────────────────────────────


@dataclass
class WorkspaceRegisterParams:
    workspace: str


# ── Workflow params ─────────────────────────────────────────────────────


@dataclass
class WorkflowRunParams:
    workflow: str
    workspace: str
    prompt: str | None = None


# ── Bridge params ───────────────────────────────────────────────────────


@dataclass
class SetLogLevelParams:
    level: str


@dataclass
class NegotiateVersionParams:
    supportedVersions: list[str]


# ── Event types ─────────────────────────────────────────────────────────


@dataclass
class EventPayload:
    type: str
    sessionId: str | None = None
    messageType: str | None = None
    message: Any = None
    content: str | None = None
    index: int | None = None
    result: Any = None
    status: str | None = None
