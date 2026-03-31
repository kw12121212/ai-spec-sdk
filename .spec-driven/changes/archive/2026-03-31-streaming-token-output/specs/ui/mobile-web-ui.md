## ADDED Requirements

### Requirement: Streaming Text Rendering
When a `bridge/session_event` notification with `messageType: "stream_chunk"` is received, the chat view MUST append the `content` text to the current streaming text bubble. The first `stream_chunk` for a new assistant turn MUST create a new chat bubble. Subsequent `stream_chunk` events MUST append to the same bubble.

When a `messageType: "assistant_text"` event is received for a bubble that was being streamed, the UI MUST replace the streaming content with the final complete text.

#### Scenario: First stream chunk creates a new bubble
- GIVEN the chat view is showing an active session
- WHEN a `stream_chunk` event with `index: 0` is received
- THEN a new chat bubble is created with the chunk text content

#### Scenario: Subsequent chunks append to existing bubble
- GIVEN a streaming text bubble exists in the chat view
- WHEN a `stream_chunk` event with `index > 0` is received
- THEN the chunk content is appended to the existing bubble's text

#### Scenario: Final assistant_text replaces streaming content
- GIVEN a streaming text bubble has accumulated partial text
- WHEN an `assistant_text` event is received for the same turn
- THEN the bubble's content is replaced with the final complete text

#### Scenario: Auto-scroll during streaming
- GIVEN the user is at the bottom of the chat view
- WHEN new `stream_chunk` events arrive
- THEN the chat view auto-scrolls to show the latest content
