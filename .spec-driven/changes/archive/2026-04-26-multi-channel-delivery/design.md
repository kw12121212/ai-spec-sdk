# Design: multi-channel-delivery

## Approach
We will leverage the existing webhook implementation in `src/webhooks.ts`. When the `session.question` notification is emitted by the agent runner, the webhook system will package the question payload into an event of type `session_question` and dispatch it to all registered webhooks.

For push notifications, we will introduce a generic HTTP push-webhook model where integrators can configure a push delivery endpoint, allowing maximum flexibility (e.g. they can route it to FCM, APNs, or a custom notification service).

## Key Decisions
- **Reuse Existing Webhooks:** Questions will flow through the existing session lifecycle webhook subscriptions rather than requiring a dedicated subscription API. This minimizes the API surface area and simplifies integrator setup.
- **Generic HTTP Push:** Instead of binding to a specific vendor (FCM, APNs), we will implement a generic HTTP push mechanism. Integrators will handle vendor-specific mapping on their end.

## Alternatives Considered
- **Dedicated Question Subscription API:** We considered adding `webhook.subscribe_questions`, but decided against it to avoid fragmentation of webhook management.
- **Direct Vendor SDK Integration (FCM/APNs):** We considered integrating Firebase Admin or APNs directly, but this would add heavy dependencies and tie the project to specific cloud providers. A generic HTTP WebPush approach is more flexible.
