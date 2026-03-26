# add-polyglot-agent-spec-bridge

## What

Introduce a local SDK bridge that packages Claude Agent SDK orchestration together with built-in spec-driven workflows behind a stable JSON-RPC 2.0 over stdio interface.

The bridge will let external tools start and resume Claude-backed agent sessions, invoke supported spec-driven workflow operations, discover bundled spec skills, and consume structured results and stream events without needing to directly embed Claude Agent SDK or slim-spec-driven internals.

## Why

The project goal is to make Claude-powered coding workflows easier for other tools to integrate. Claude Agent SDK already provides powerful agent execution primitives, and slim-spec-driven already provides a disciplined workflow for brainstorming, proposing, applying, verifying, and archiving changes, but today an integrator would need to wire those pieces together manually.

This change defines the first external contract for that integration layer. By standardizing a local bridge protocol, downstream tools can adopt the SDK from any language that can speak JSON-RPC over stdio, while the SDK remains responsible for coordinating session lifecycle, workspace execution, and built-in spec-driven behavior.

## Scope

In scope:
- A JSON-RPC 2.0 over stdio bridge contract for local integration
- High-level workflow operations for supported spec-driven commands
- Claude agent session start, resume, stop, and status behavior
- Structured error responses and stream notifications for long-running work
- Discovery of built-in spec-driven skills exposed by the SDK
- Explicit workspace-oriented execution boundaries for bridge requests

Out of scope:
- HTTP or remote deployment interfaces
- Multi-tenant account management or remote job scheduling
- A plugin marketplace or arbitrary third-party skill installation flow
- Full one-to-one passthrough of every underlying Claude Agent SDK option
- Non-local transport adapters beyond stdio in this first change

## Unchanged Behavior

Behaviors that must not change as a result of this change (leave blank if nothing is at risk):
- The underlying Claude Agent SDK remains the execution engine for agent work rather than being reimplemented by this project.
- The spec-driven artifact model, spec format, and workflow semantics remain aligned with slim-spec-driven instead of being replaced with a new process.
- Authentication requirements for Claude-backed execution remain those required by Claude Agent SDK and its supported providers.
