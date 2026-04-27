## Resolved

### Question
Are responses expected to be delivered exclusively via the JSON-RPC interface, or should we also implement HTTP POST webhooks for answering?

#### Answer
Define a single JSON-RPC method `session.answerQuestion` first, and expose it via the existing HTTP bridge later if needed.

### Question
What should the bridge do if an answer is received for a session that has already timed out, been cancelled, or is no longer waiting for input?

#### Answer
Return a specific error code (e.g., `-32602`) indicating the session is no longer waiting for that answer.
