# Proposal: response-correlation

## What
Implement the capability to match incoming asynchronous human responses to specific pending questions emitted by paused agent sessions.

## Why
Agents can now pause execution and emit questions to human operators (`question-payload`) through various channels (`multi-channel-delivery`). To resume these sessions, the bridge must accept the response, correlate it with the waiting session, and provide it to the agent upon resumption.

## Scope
- Define JSON-RPC method `session.answerQuestion` for submitting answers.
- Validate that the response targets a session currently in the `waiting_for_input` state.
- Correlate the response to the pending request using the session identifier.
- Ensure expired or invalid responses are rejected with clear error codes.

## Unchanged Behavior
- The structure of the emitted question payload remains identical.
- Webhook delivery mechanism for outgoing questions remains unchanged.
