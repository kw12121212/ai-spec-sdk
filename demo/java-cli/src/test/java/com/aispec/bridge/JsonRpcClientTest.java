package com.aispec.bridge;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for JsonRpcClient.
 */
class JsonRpcClientTest {

    @TempDir
    Path tempDir;

    private Path mockBridgeScript;

    @BeforeEach
    void setUp() throws IOException {
        // Create a mock bridge script that responds to ping
        mockBridgeScript = tempDir.resolve("mock-bridge.js");
        String script = """
            const readline = require('readline');
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
                terminal: false
            });
            
            rl.on('line', (line) => {
                try {
                    const req = JSON.parse(line);
                    if (req.method === 'bridge.ping') {
                        const res = {
                            jsonrpc: '2.0',
                            id: req.id,
                            result: { pong: true, ts: Date.now() }
                        };
                        console.log(JSON.stringify(res));
                    } else if (req.method === 'test.echo') {
                        const res = {
                            jsonrpc: '2.0',
                            id: req.id,
                            result: req.params
                        };
                        console.log(JSON.stringify(res));
                    } else if (req.method === 'test.error') {
                        const res = {
                            jsonrpc: '2.0',
                            id: req.id,
                            error: { code: -1, message: 'Test error' }
                        };
                        console.log(JSON.stringify(res));
                    } else if (req.method === 'test.notify') {
                        // Send notification then response
                        const notif = {
                            jsonrpc: '2.0',
                            method: 'test/notification',
                            params: { message: 'hello' }
                        };
                        console.log(JSON.stringify(notif));
                        
                        const res = {
                            jsonrpc: '2.0',
                            id: req.id,
                            result: { notified: true }
                        };
                        console.log(JSON.stringify(res));
                    }
                } catch (e) {
                    // Ignore parse errors
                }
            });
            """;
        Files.writeString(mockBridgeScript, script);
    }

    @AfterEach
    void tearDown() {
        // Cleanup handled by client close
    }

    @Test
    void testClientCreation() throws IOException {
        JsonRpcClient client = new JsonRpcClient(mockBridgeScript.toString());
        assertNotNull(client);
        assertFalse(client.isClosed());
        client.close();
        assertTrue(client.isClosed());
    }

    @Test
    void testPing() throws IOException {
        JsonRpcClient client = new JsonRpcClient(mockBridgeScript.toString());
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> result = (Map<String, Object>) client.call("bridge.ping", null);
            assertNotNull(result);
            assertEquals(true, result.get("pong"));
            assertNotNull(result.get("ts"));
        } finally {
            client.close();
        }
    }

    @Test
    void testEcho() throws IOException {
        JsonRpcClient client = new JsonRpcClient(mockBridgeScript.toString());
        try {
            Map<String, Object> params = Map.of("message", "hello", "count", 42);
            @SuppressWarnings("unchecked")
            Map<String, Object> result = (Map<String, Object>) client.call("test.echo", params);
            assertNotNull(result);
            assertEquals("hello", result.get("message"));
            assertEquals(42, result.get("count"));
        } finally {
            client.close();
        }
    }

    @Test
    void testErrorResponse() throws IOException {
        JsonRpcClient client = new JsonRpcClient(mockBridgeScript.toString());
        try {
            RuntimeException exception = assertThrows(RuntimeException.class, () -> {
                client.call("test.error", null);
            });
            assertTrue(exception.getMessage().contains("Test error"));
        } finally {
            client.close();
        }
    }

    @Test
    void testNotificationHandler() throws IOException, InterruptedException {
        JsonRpcClient client = new JsonRpcClient(mockBridgeScript.toString());
        try {
            AtomicReference<String> receivedMessage = new AtomicReference<>();
            
            client.onNotification("test/notification", (Consumer<Notification>) n -> {
                @SuppressWarnings("unchecked")
                Map<String, Object> params = (Map<String, Object>) n.getParams();
                receivedMessage.set((String) params.get("message"));
            });
            
            client.call("test.notify", null);
            
            // Wait a bit for notification to be processed
            Thread.sleep(100);
            
            assertEquals("hello", receivedMessage.get());
        } finally {
            client.close();
        }
    }

    @Test
    void testOffNotification() throws IOException, InterruptedException {
        JsonRpcClient client = new JsonRpcClient(mockBridgeScript.toString());
        try {
            AtomicReference<String> receivedMessage = new AtomicReference<>();
            
            Consumer<Notification> handler = n -> {
                @SuppressWarnings("unchecked")
                Map<String, Object> params = (Map<String, Object>) n.getParams();
                receivedMessage.set((String) params.get("message"));
            };
            
            client.onNotification("test/notification", handler);
            client.offNotification("test/notification");
            
            client.call("test.notify", null);
            
            // Wait a bit
            Thread.sleep(100);
            
            // Handler was removed, so message should still be null
            assertNull(receivedMessage.get());
        } finally {
            client.close();
        }
    }

    @Test
    void testCallAfterClose() throws IOException {
        JsonRpcClient client = new JsonRpcClient(mockBridgeScript.toString());
        client.close();
        
        assertThrows(IllegalStateException.class, () -> {
            client.call("bridge.ping", null);
        });
    }
}
