package com.aispec.session;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for SessionManager.
 */
class SessionManagerTest {

    @Test
    void testConstructor() {
        SessionManager sessionManager = new SessionManager(null, "/workspace", "claude-test", "approve");
        assertEquals("/workspace", sessionManager.getCurrentWorkspace());
        assertEquals("claude-test", sessionManager.getCurrentModel());
        assertEquals("approve", sessionManager.getPermissionMode());
        assertNull(sessionManager.getCurrentSessionId());
    }

    @Test
    void testSettersAndGetters() {
        SessionManager sessionManager = new SessionManager(null, "/workspace", "claude-test", "approve");

        sessionManager.setCurrentSessionId("session-123");
        assertEquals("session-123", sessionManager.getCurrentSessionId());

        sessionManager.setCurrentModel("claude-opus");
        assertEquals("claude-opus", sessionManager.getCurrentModel());

        sessionManager.setCurrentWorkspace("/new/workspace");
        assertEquals("/new/workspace", sessionManager.getCurrentWorkspace());

        sessionManager.setPermissionMode("bypass");
        assertEquals("bypass", sessionManager.getPermissionMode());
    }

    @Test
    void testStopWithoutSession() {
        SessionManager sessionManager = new SessionManager(null, "/workspace", "claude-test", "approve");

        assertThrows(IllegalStateException.class, () -> {
            sessionManager.stop();
        });
    }

    @Test
    void testUsageModel() {
        Usage usage = new Usage();
        usage.setInputTokens(100);
        usage.setOutputTokens(50);

        assertEquals(100, usage.getInputTokens());
        assertEquals(50, usage.getOutputTokens());
        assertEquals("input=100 output=50", usage.toString());
    }

    @Test
    void testSessionModel() {
        Session session = new Session();
        session.setSessionId("session-abc");
        session.setStatus("active");
        session.setWorkspace("/workspace");
        session.setCreatedAt("2024-01-01T00:00:00Z");
        session.setUpdatedAt("2024-01-01T01:00:00Z");

        assertEquals("session-abc", session.getSessionId());
        assertEquals("active", session.getStatus());
        assertEquals("/workspace", session.getWorkspace());
        assertEquals("2024-01-01T00:00:00Z", session.getCreatedAt());
        assertEquals("2024-01-01T01:00:00Z", session.getUpdatedAt());
    }

    @Test
    void testStartResult() {
        java.util.Map<String, Object> data = new java.util.HashMap<>();
        data.put("sessionId", "session-xyz");
        data.put("status", "completed");
        data.put("result", "test result");

        java.util.Map<String, Object> usageData = new java.util.HashMap<>();
        usageData.put("inputTokens", 10);
        usageData.put("outputTokens", 20);
        data.put("usage", usageData);

        SessionManager.StartResult result = new SessionManager.StartResult(data);

        assertEquals("session-xyz", result.getSessionId());
        assertEquals("completed", result.getStatus());
        assertEquals("test result", result.getResult());
        assertNotNull(result.getUsage());
        assertEquals(10, result.getUsage().getInputTokens());
        assertEquals(20, result.getUsage().getOutputTokens());
    }

    @Test
    void testHistoryResult() {
        java.util.Map<String, Object> data = new java.util.HashMap<>();
        data.put("sessionId", "session-123");
        data.put("total", 42);
        data.put("entries", java.util.List.of("entry1", "entry2", "entry3"));

        SessionManager.HistoryResult result = new SessionManager.HistoryResult(data);

        assertEquals("session-123", result.getSessionId());
        assertEquals(42, result.getTotal());
        assertEquals(3, result.getEntries().size());
    }
}
