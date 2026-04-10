package com.aispec.workflow;

import com.aispec.bridge.JsonRpcClient;
import com.aispec.bridge.Notification;
import com.aispec.ui.TerminalRenderer;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

/**
 * Workflow runner for listing and executing spec-driven workflows.
 */
public class WorkflowRunner {

    private final JsonRpcClient client;

    /**
     * Creates a new workflow runner.
     *
     * @param client The JSON-RPC client
     */
    public WorkflowRunner(JsonRpcClient client) {
        this.client = client;
    }

    /**
     * Lists available workflows from bridge capabilities.
     *
     * @return List of workflow names
     */
    @SuppressWarnings("unchecked")
    public List<String> list() {
        Map<String, Object> result = (Map<String, Object>) client.call("bridge.capabilities", null);
        if (result != null && result.containsKey("workflows")) {
            return (List<String>) result.get("workflows");
        }
        return List.of();
    }

    /**
     * Runs a workflow by name.
     *
     * @param name      The workflow name
     * @param workspace The workspace to run in
     * @return The workflow result
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> run(String name, String workspace) {
        // Set up progress notification handler
        client.onNotification("bridge/progress", (Consumer<Notification>) n -> {
            Map<String, Object> params = n.getParams();
            String message = (String) params.get("message");
            if (message != null) {
                TerminalRenderer.renderProgress(message);
            }
        });

        Map<String, Object> params = new HashMap<>();
        params.put("name", name);
        params.put("workspace", workspace);

        return (Map<String, Object>) client.call("workflow.run", params);
    }
}
