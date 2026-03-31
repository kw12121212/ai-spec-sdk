"""Unit tests for types module."""

from __future__ import annotations

import pytest

from ai_spec_sdk.types import (
    EventPayload,
    SessionStartParams,
    SessionResumeParams,
    SessionStopParams,
    ConfigGetParams,
    ConfigSetParams,
    McpAddParams,
    HooksAddParams,
    ContextReadParams,
    WorkflowRunParams,
    NegotiateVersionParams,
    SetLogLevelParams,
)


def test_session_start_params_defaults():
    params = SessionStartParams(workspace="/tmp", prompt="Hello")
    assert params.model is None
    assert params.allowedTools is None
    assert params.stream is False


def test_session_start_params_all_fields():
    params = SessionStartParams(
        workspace="/tmp",
        prompt="Hello",
        model="claude-opus-4-6",
        allowedTools=["Read", "Edit"],
        disallowedTools=["Bash"],
        permissionMode="bypassPermissions",
        maxTurns=10,
        systemPrompt="Be helpful",
        stream=True,
    )
    assert params.model == "claude-opus-4-6"
    assert params.allowedTools == ["Read", "Edit"]
    assert params.stream is True


def test_session_resume_params():
    params = SessionResumeParams(sessionId="abc-123", prompt="Continue")
    assert params.sessionId == "abc-123"
    assert params.prompt == "Continue"


def test_session_stop_params():
    params = SessionStopParams(sessionId="abc-123")
    assert params.sessionId == "abc-123"


def test_config_get_params():
    params = ConfigGetParams(key="logLevel", workspace="/tmp")
    assert params.key == "logLevel"


def test_config_set_params():
    params = ConfigSetParams(key="logLevel", value="debug", workspace="/tmp", scope="project")
    assert params.scope == "project"


def test_mcp_add_params_defaults():
    params = McpAddParams(workspace="/tmp", name="server", command="node server.js")
    assert params.args == []
    assert params.env == {}


def test_hooks_add_params():
    params = HooksAddParams(event="pre_tool_use", command="echo test", matcher="Bash")
    assert params.matcher == "Bash"
    assert params.scope == "project"


def test_context_read_params():
    params = ContextReadParams(scope="project", path="CLAUDE.md", workspace="/tmp")
    assert params.scope == "project"


def test_workflow_run_params():
    params = WorkflowRunParams(workflow="my-flow", workspace="/tmp", prompt="Run it")
    assert params.workflow == "my-flow"


def test_negotiate_version_params():
    params = NegotiateVersionParams(supportedVersions=["0.2.0"])
    assert params.supportedVersions == ["0.2.0"]


def test_set_log_level_params():
    params = SetLogLevelParams(level="debug")
    assert params.level == "debug"


def test_event_payload_minimal():
    payload = EventPayload(type="agent_message")
    assert payload.sessionId is None
    assert payload.messageType is None


def test_event_payload_full():
    payload = EventPayload(
        type="agent_message",
        sessionId="abc-123",
        messageType="assistant_text",
        message={"content": "Hello"},
    )
    assert payload.sessionId == "abc-123"
    assert payload.messageType == "assistant_text"
