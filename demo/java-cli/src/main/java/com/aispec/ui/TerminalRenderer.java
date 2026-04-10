package com.aispec.ui;

import com.aispec.session.Usage;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.List;
import java.util.Map;

/**
 * Terminal rendering for session events, tool approval prompts, and multi-line input.
 */
public class TerminalRenderer {

    // ANSI color codes
    private static final String RESET = "\033[0m";
    private static final String BOLD = "\033[1m";
    private static final String GREEN = "\033[32m";
    private static final String YELLOW = "\033[33m";
    private static final String CYAN = "\033[36m";
    private static final String RED = "\033[31m";
    private static final String DIM = "\033[2m";

    private static final BufferedReader STDIN_READER = new BufferedReader(new InputStreamReader(System.in));

    /**
     * Formats a session event notification for terminal display.
     *
     * @param params The event parameters
     */
    @SuppressWarnings("unchecked")
    public static void renderEvent(Map<String, Object> params) {
        String type = (String) params.get("type");
        if (type == null) return;

        switch (type) {
            case "session_started" -> {
                String sessionId = (String) params.get("sessionId");
                System.out.printf("%s● Session started%s: %s%n", GREEN, RESET, sessionId);
            }
            case "session_resumed" -> {
                String sessionId = (String) params.get("sessionId");
                System.out.printf("%s● Session resumed%s: %s%n", GREEN, RESET, sessionId);
            }
            case "session_completed" -> {
                System.out.printf("%s● Session completed%s%n", GREEN, RESET);

                Map<String, Object> usageData = (Map<String, Object>) params.get("usage");
                if (usageData != null) {
                    Object input = usageData.get("inputTokens");
                    Object output = usageData.get("outputTokens");
                    System.out.printf("  %sTokens:%s input=%s output=%s%n",
                        DIM, RESET, input, output);
                }

                Object result = params.get("result");
                if (result != null) {
                    String resultStr = truncate(result.toString(), 200);
                    System.out.printf("  %sResult:%s %s%n", DIM, RESET, resultStr);
                }
            }
            case "session_stopped" -> {
                String status = (String) params.get("status");
                System.out.printf("%s● Session stopped%s: %s%n", YELLOW, RESET, status);
            }
            case "agent_message" -> renderAgentMessage(params);
        }
    }

    /**
     * Renders progress messages from workflows.
     *
     * @param message The progress message
     */
    public static void renderProgress(String message) {
        System.out.printf("%s...%s %s%n", DIM, RESET, message);
    }

    @SuppressWarnings("unchecked")
    private static void renderAgentMessage(Map<String, Object> params) {
        Map<String, Object> msg = (Map<String, Object>) params.get("message");
        if (msg == null) return;

        String messageType = (String) msg.get("messageType");
        if (messageType == null) return;

        switch (messageType) {
            case "system_init" -> {
                String model = (String) msg.get("model");
                String sessionId = (String) msg.get("session_id");
                System.out.printf("%s%sConnected%s — model: %s, session: %s%n",
                    BOLD, CYAN, RESET, model, sessionId);
            }
            case "assistant_text" -> {
                String text = extractText(msg);
                if (!text.isEmpty()) {
                    System.out.println();
                    System.out.println(text);
                }
            }
            case "tool_use" -> {
                Map<String, Object> toolData = (Map<String, Object>) msg.get("tool");
                if (toolData != null) {
                    String name = (String) toolData.get("name");
                    Object input = toolData.get("input");

                    System.out.printf("%n%s⚡ Tool:%s %s%n", YELLOW, RESET, name);
                    String prettyInput = prettyPrint(input);
                    for (String line : prettyInput.split("\n")) {
                        System.out.printf("  %s%s%s%n", DIM, line, RESET);
                    }
                }
            }
            case "tool_result" -> {
                String resultStr = extractToolResult(msg);
                String[] lines = resultStr.split("\n");
                if (lines.length > 5) {
                    for (int i = 0; i < 5; i++) {
                        System.out.printf("  %s%s%s%n", DIM, lines[i], RESET);
                    }
                    System.out.printf("  %s... (%d more lines)%s%n",
                        DIM, lines.length - 5, RESET);
                } else {
                    for (String line : lines) {
                        System.out.printf("  %s%s%s%n", DIM, line, RESET);
                    }
                }
            }
            case "result" -> {
                String subtype = (String) msg.get("subtype");
                String result = (String) msg.get("result");
                if ("error".equals(subtype)) {
                    System.out.printf("%n%sError:%s %s%n", RED, RESET, result);
                }
            }
        }
    }

    /**
     * Prompts the user for tool approval.
     *
     * @param request The tool approval request parameters
     * @return true if approved, false if rejected
     */
    @SuppressWarnings("unchecked")
    public static boolean promptToolApproval(Map<String, Object> request) {
        String toolName = (String) request.get("toolName");
        Map<String, Object> toolInput = (Map<String, Object>) request.get("toolInput");

        System.out.printf("%n%s⚡ Tool approval requested%s%n", YELLOW, RESET);
        System.out.printf("  Tool: %s%n", toolName);
        if (toolInput != null) {
            System.out.printf("  Input: %s%n", prettyPrint(toolInput));
        }
        System.out.printf("%s[approve? y/n]:%s ", BOLD, RESET);
        System.out.flush();

        try {
            String response = STDIN_READER.readLine();
            return response != null && response.trim().toLowerCase().startsWith("y");
        } catch (IOException e) {
            return false;
        }
    }

    @SuppressWarnings("unchecked")
    private static String extractText(Map<String, Object> msg) {
        Object content = msg.get("content");
        if (content instanceof List) {
            List<Map<String, Object>> blocks = (List<Map<String, Object>>) content;
            StringBuilder sb = new StringBuilder();
            for (Map<String, Object> block : blocks) {
                if ("text".equals(block.get("type"))) {
                    Object text = block.get("text");
                    if (text != null) {
                        sb.append(text.toString());
                    }
                }
            }
            return sb.toString();
        }
        return "";
    }

    @SuppressWarnings("unchecked")
    private static String extractToolResult(Map<String, Object> msg) {
        Map<String, Object> result = (Map<String, Object>) msg.get("result");
        if (result != null) {
            Object content = result.get("content");
            if (content instanceof List) {
                List<Map<String, Object>> items = (List<Map<String, Object>>) content;
                StringBuilder sb = new StringBuilder();
                for (Map<String, Object> item : items) {
                    if ("text".equals(item.get("type"))) {
                        Object text = item.get("text");
                        if (text != null) {
                            sb.append(text.toString());
                        }
                    }
                }
                return sb.toString();
            }
            return result.toString();
        }
        return "";
    }

    private static String prettyPrint(Object obj) {
        if (obj == null) return "null";
        if (obj instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> map = (Map<String, Object>) obj;
            StringBuilder sb = new StringBuilder();
            sb.append("{");
            boolean first = true;
            for (Map.Entry<String, Object> entry : map.entrySet()) {
                if (!first) sb.append(", ");
                sb.append(entry.getKey()).append("=");
                Object value = entry.getValue();
                if (value instanceof String) {
                    sb.append("\"").append(value).append("\"");
                } else {
                    sb.append(value);
                }
                first = false;
            }
            sb.append("}");
            return sb.toString();
        }
        return obj.toString();
    }

    private static String truncate(String s, int maxLen) {
        if (s == null) return "";
        if (s.length() <= maxLen) return s;
        return s.substring(0, maxLen) + "...";
    }
}
