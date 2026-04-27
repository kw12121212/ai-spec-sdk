# Proposal: multi-channel-delivery

## What
Implement multi-channel delivery for the Question Resolution Protocol by extending the existing webhook infrastructure to deliver `session_question` events to subscribed webhooks, and introducing a generic HTTP Push mechanism.

## Why
Agents need to be able to pause and ask human users questions asynchronously. Delivering these structured questions via webhooks and generic push mechanisms ensures that downstream integrations (like mobile clients or chat platforms) receive the question promptly, enabling human-in-the-loop workflows.

## Scope
- Extend the existing webhook delivery system to emit `session_question` events when an agent asks a question.
- Implement a generic HTTP WebPush or push notification adapter.
- Ensure the delivery system retries failed deliveries using the existing exponential backoff logic.
- Reuse existing webhook subscriptions for question delivery.

## Unchanged Behavior
- Existing session lifecycle webhook events (`session_started`, `session_completed`, etc.) remain unchanged.
- The structured payload format defined in `question-payload` remains intact.
- Authentication, HMAC-SHA256 signing, and retry policies for webhooks are not modified.
