"""Pytest conftest — mocks claude_agent_sdk so tests run without the real package."""

from __future__ import annotations

import sys
from unittest.mock import MagicMock

import pytest


# Create mock claude_agent_sdk module so we can import our code
# without actually having claude-agent-sdk installed.
_mock_sdk = MagicMock()
_mock_sdk.ClaudeSDKClient = MagicMock
_mock_sdk.ClaudeAgentOptions = MagicMock
sys.modules.setdefault("claude_agent_sdk", _mock_sdk)
