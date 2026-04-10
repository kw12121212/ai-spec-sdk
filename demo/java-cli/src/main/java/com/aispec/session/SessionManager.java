package com.aispec.session;

import com.aispec.bridge.JsonRpcClient;
import com.aispec.bridge.Notification;
import com.aispec.ui.TerminalRenderer;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

/**
 * High-level session manager that wraps the JSON-RPC bridge client with methods for
 * starting, resuming, stopping, listing, and inspecting agent sessions.
 */
public class SessionManager {

    private final JsonRpcClient client;
    private String currentSessionId;
    private String currentModel;
    private String currentWorkspace;
    private String permissionMode;

    /**
     * Creates a new session manager.
     *
     * @param client         The JSON-RPC client
     * @param workspace      The default workspace path
     * @param model          The default Claude model ID
     * @param permissionMode The tool permission mode
     */
    public SessionManager(JsonRpcClient client, String workspace, String model, String permissionMode) {
        this.client = client;
        this.currentWorkspace = workspace;
        this.currentModel = model;
        this.permissionMode = permissionMode;
    }

    /**
     * Creates a new agent session with the given prompt.
     *
     * @param prompt The user prompt to start the session with
     * @return The start result containing session ID and status
     */
    @SuppressWarnings("unchecked")
    public StartResult start(String prompt) {
        // Set up notification handlers
        client.onNotification("bridge/session_event", (Consumer<Notification>) n ->
            TerminalRenderer.renderEvent(n.getParams())
        );

        client.onNotification("bridge/tool_approval_requested", (Consumer<Notification>) n -> {
            Map<String, Object> params = n.getParams();
            String requestId = (String) params.get("requestId");
            boolean approved = TerminalRenderer.promptToolApproval(params);

            if (approved) {
                approveTool(requestId);
            } else {
                rejectTool(requestId, "User rejected");
            }
        });

        Map<String, Object> params = new HashMap<>();
        params.put("prompt", prompt);
        params.put("workspace", currentWorkspace);
        params.put("model", currentModel);
        params.put("permissionMode", permissionMode);

        Map<String, Object> result = (Map<String, Object>) client.call("session.start", params);

        if (result != null && result.get("sessionId") != null) {
            currentSessionId = (String) result.get("sessionId");
        }

        return new StartResult(result);
    }

    /**
     * Resumes an existing session with a follow-up prompt.
     *
     * @param sessionId The session ID to resume
     * @param prompt    The follow-up prompt
     * @return The resume result
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> resume(String sessionId, String prompt) {
        Map<String, Object> params = new HashMap<>();
        params.put("sessionId", sessionId);
        params.put("prompt", prompt);

        Map<String, Object> result = (Map<String, Object>) client.call("session.resume", params);
        currentSessionId = sessionId;
        return result;
    }

    /**
     * Stops the current session.
     *
     * @return The stop result
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> stop() {
        if (currentSessionId == null) {
            throw new IllegalStateException("No active session");
        }

        Map<String, Object> params = new HashMap<>();
        params.put("sessionId", currentSessionId);

        Map<String, Object> result = (Map<String, Object>) client.call("session.stop", params);
        return result;
    }

    /**
     * Lists sessions.
     *
     * @param status Optional status filter ("active" or "all")
     * @return List of session entries
     */
    @SuppressWarnings("unchecked")
    public List<Session> list(String status) {
        Map<String, Object> params = new HashMap<>();
        if (status != null) {
            params.put("status", status);
        }

        Map<String, Object> result = (Map<String, Object>) client.call("session.list", params);
        List<Map<String, Object>> sessionsData = (List<Map<String, Object>>) result.get("sessions");

        return sessionsData.stream()
            .map(this::convertToSession)
            .toList();
    }

    /**
     * Gets session history.
     *
     * @param sessionId The session ID
     * @param offset    Pagination offset
     * @param limit     Pagination limit
     * @return History result
     */
    @SuppressWarnings("unchecked")
    public HistoryResult history(String sessionId, int offset, int limit) {
        Map<String, Object> params = new HashMap<>();
        params.put("sessionId", sessionId);
        params.put("offset", offset);
        params.put("limit", limit);

        Map<String, Object> result = (Map<String, Object>) client.call("session.history", params);
        return new HistoryResult(result);
    }

    /**
     * Approves a tool use request.
     *
     * @param requestId The tool approval request ID
     */
    public void approveTool(String requestId) {
        Map<String, Object> params = new HashMap<>();
        params.put("requestId", requestId);
        client.call("session.approveTool", params);
    }

    /**
     * Rejects a tool use request.
     *
     * @param requestId The tool approval request ID
     * @param message   Optional rejection message
     */
    public void rejectTool(String requestId, String message) {
        Map<String, Object> params = new HashMap<>();
        params.put("requestId", requestId);
        if (message != null) {
            params.put("message", message);
        }
        client.call("session.rejectTool", params);
    }

    /**
     * Gets the current session ID.
     */
    public String getCurrentSessionId() {
        return currentSessionId;
    }

    /**
     * Sets the current session ID.
     */
    public void setCurrentSessionId(String sessionId) {
        this.currentSessionId = sessionId;
    }

    /**
     * Gets the current model.
     */
    public String getCurrentModel() {
        return currentModel;
    }

    /**
     * Sets the current model.
     */
    public void setCurrentModel(String model) {
        this.currentModel = model;
    }

    /**
     * Gets the current workspace.
     */
    public String getCurrentWorkspace() {
        return currentWorkspace;
    }

    /**
     * Sets the current workspace.
     */
    public void setCurrentWorkspace(String workspace) {
        this.currentWorkspace = workspace;
    }

    /**
     * Gets the permission mode.
     */
    public String getPermissionMode() {
        return permissionMode;
    }

    /**
     * Sets the permission mode.
     */
    public void setPermissionMode(String mode) {
        this.permissionMode = mode;
    }

    @SuppressWarnings("unchecked")
    private Session convertToSession(Map<String, Object> data) {
        Session session = new Session();
        session.setSessionId((String) data.get("sessionId"));
        session.setStatus((String) data.get("status"));
        session.setWorkspace((String) data.get("workspace"));
        session.setCreatedAt((String) data.get("createdAt"));
        session.setUpdatedAt((String) data.get("updatedAt"));
        session.setPrompt(data.get("prompt"));
        return session;
    }

    /**
     * Result from session.start.
     */
    public static class StartResult {
        private final String sessionId;
        private final String status;
        private final Object result;
        private final Usage usage;

        @SuppressWarnings("unchecked")
        public StartResult(Map<String, Object> data) {
            this.sessionId = (String) data.get("sessionId");
            this.status = (String) data.get("status");
            this.result = data.get("result");

            Map<String, Object> usageData = (Map<String, Object>) data.get("usage");
            if (usageData != null) {
                this.usage = new Usage();
                Object input = usageData.get("inputTokens");
                Object output = usageData.get("outputTokens");
                if (input instanceof Number) {
                    this.usage.setInputTokens(((Number) input).intValue());
                }
                if (output instanceof Number) {
                    this.usage.setOutputTokens(((Number) output).intValue());
                }
            } else {
                this.usage = null;
            }
        }

        public String getSessionId() {
            return sessionId;
        }

        public String getStatus() {
            return status;
        }

        public Object getResult() {
            return result;
        }

        public Usage getUsage() {
            return usage;
        }
    }

    /**
     * Result from session.history.
     */
    public static class HistoryResult {
        private final String sessionId;
        private final int total;
        private final List<Object> entries;

        @SuppressWarnings("unchecked")
        public HistoryResult(Map<String, Object> data) {
            this.sessionId = (String) data.get("sessionId");
            Object totalObj = data.get("total");
            this.total = totalObj instanceof Number ? ((Number) totalObj).intValue() : 0;
            this.entries = (List<Object>) data.get("entries");
        }

        public String getSessionId() {
            return sessionId;
        }

        public int getTotal() {
            return total;
        }

        public List<Object> getEntries() {
            return entries;
        }
    }
}
