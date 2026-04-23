# Proposal: token-attribution

## What
Implement granular token tracking and attribution per message and tool call within the SDK.

## Why
While the current system has robust session and provider-level aggregate tracking, debugging token consumption, cost optimization, and predictive budgeting all require high-fidelity token accounting. By recording token cost at the granular level of individual messages and tool interactions, clients can precisely determine what triggered spikes in their budget consumption.

## Scope
- Expand token recording to handle `messageId` and associate usage with specific LLM responses and interactions.
- Provide `token.getMessageUsage` bridge capabilities to retrieve this data.
- Enforce token limits per message if applicable in future features, but initially focus purely on accurately recording the consumption.

## Unchanged Behavior
- Session-level, provider-level, and global quota tracking behaviors and formats remain identical.
- Token budget mechanics continue to behave the same way on their respective scopes.
