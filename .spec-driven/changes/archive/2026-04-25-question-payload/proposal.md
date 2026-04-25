# Proposal: question-payload

## What
Implement the structured question payload format and the foundational types needed to support the Question Resolution Protocol.

## Why
Agents need a rigorous way to pause execution and ask humans for clarification, direction, or approval without relying on unstructured chat interfaces. A structured payload ensures questions include context, impact, and actionable options.

## Scope
- Define `QuestionPayload` interface with fields for `question`, `impact`, `recommendation`, and `options`.
- Update session state to support a `paused` or `awaiting_resolution` status.
- Add a new JSON-RPC notification for emitting questions.
- Add a new JSON-RPC method for resolving questions and resuming the session.

## Unchanged Behavior
- Existing agent tools, quotas, task queues, and team registries remain unaffected.
- The standard session stream (text/tool calls) continues to function as before.
