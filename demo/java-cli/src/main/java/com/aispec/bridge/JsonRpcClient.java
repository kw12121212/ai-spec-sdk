package com.aispec.bridge;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.*;
import java.util.Map;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;

/**
 * JSON-RPC 2.0 client that communicates with the ai-spec-bridge process over stdio.
 * Spawns the bridge as a subprocess, sends requests via stdin, and reads responses/notifications from stdout.
 */
public class JsonRpcClient implements AutoCloseable {

    private final Process process;
    private final BufferedWriter writer;
    private final BufferedReader reader;
    private final ObjectMapper mapper;
    private final AtomicLong nextId;
    private final Map<Long, CompletableFuture<Response>> pendingRequests;
    private final Map<String, Consumer<Notification>> notificationHandlers;
    private final ExecutorService readerExecutor;
    private volatile boolean closed = false;

    /**
     * Creates a new JSON-RPC client connected to the bridge subprocess.
     *
     * @param bridgePath Path to the bridge JavaScript file (e.g., "dist/src/cli.js")
     * @throws IOException if the subprocess cannot be started
     */
    public JsonRpcClient(String bridgePath) throws IOException {
        this.mapper = new ObjectMapper();
        this.nextId = new AtomicLong(0);
        this.pendingRequests = new ConcurrentHashMap<>();
        this.notificationHandlers = new ConcurrentHashMap<>();

        ProcessBuilder pb = new ProcessBuilder("node", bridgePath);
        pb.redirectError(ProcessBuilder.Redirect.INHERIT);
        this.process = pb.start();

        this.writer = new BufferedWriter(new OutputStreamWriter(process.getOutputStream()));
        this.reader = new BufferedReader(new InputStreamReader(process.getInputStream()));

        // Start background reader thread
        this.readerExecutor = Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "jsonrpc-reader");
            t.setDaemon(true);
            return t;
        });
        this.readerExecutor.submit(this::readLoop);
    }

    /**
     * Sends a JSON-RPC request and waits for the response.
     *
     * @param method  The method name to call
     * @param params  The method parameters (may be null)
     * @return The result object from the response
     * @throws RuntimeException if the request fails or returns an error
     */
    public Object call(String method, Map<String, Object> params) {
        if (closed) {
            throw new IllegalStateException("Client is closed");
        }

        long id = nextId.incrementAndGet();
        Request request = new Request(id, method, params);
        CompletableFuture<Response> future = new CompletableFuture<>();
        pendingRequests.put(id, future);

        try {
            String json = mapper.writeValueAsString(request);
            synchronized (writer) {
                writer.write(json);
                writer.newLine();
                writer.flush();
            }
        } catch (IOException e) {
            pendingRequests.remove(id);
            throw new RuntimeException("Failed to send request: " + e.getMessage(), e);
        }

        try {
            Response response = future.get(60, TimeUnit.SECONDS);
            if (response.hasError()) {
                throw new RuntimeException("RPC error: " + response.getError().getMessage());
            }
            return response.getResult();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Request interrupted", e);
        } catch (ExecutionException e) {
            throw new RuntimeException("Request failed: " + e.getCause().getMessage(), e.getCause());
        } catch (TimeoutException e) {
            pendingRequests.remove(id);
            throw new RuntimeException("Request timed out", e);
        }
    }

    /**
     * Registers a handler for notifications of a specific method.
     *
     * @param method  The notification method name
     * @param handler The handler to invoke when notifications are received
     */
    public void onNotification(String method, Consumer<Notification> handler) {
        notificationHandlers.put(method, handler);
    }

    /**
     * Unregisters a notification handler.
     *
     * @param method The notification method name
     */
    public void offNotification(String method) {
        notificationHandlers.remove(method);
    }

    /**
     * Background loop that reads responses and notifications from stdout.
     */
    private void readLoop() {
        try {
            String line;
            while (!closed && (line = reader.readLine()) != null) {
                try {
                    // Try to parse as Response first (has "id")
                    Map<String, Object> raw = mapper.readValue(line, Map.class);
                    if (raw.containsKey("id")) {
                        Response response = mapper.convertValue(raw, Response.class);
                        CompletableFuture<Response> future = pendingRequests.remove(response.getId());
                        if (future != null) {
                            future.complete(response);
                        }
                    } else if (raw.containsKey("method")) {
                        // It's a notification
                        Notification notification = mapper.convertValue(raw, Notification.class);
                        Consumer<Notification> handler = notificationHandlers.get(notification.getMethod());
                        if (handler != null) {
                            handler.accept(notification);
                        }
                    }
                } catch (Exception e) {
                    // Log but continue reading
                    System.err.println("Failed to parse message: " + line);
                }
            }
        } catch (IOException e) {
            if (!closed) {
                System.err.println("Read loop error: " + e.getMessage());
            }
        }
    }

    @Override
    public void close() {
        closed = true;

        // Complete any pending requests with error
        for (CompletableFuture<Response> future : pendingRequests.values()) {
            future.completeExceptionally(new RuntimeException("Client closed"));
        }
        pendingRequests.clear();

        // Shutdown reader executor
        readerExecutor.shutdownNow();

        // Destroy the process
        process.destroy();
        try {
            if (!process.waitFor(5, TimeUnit.SECONDS)) {
                process.destroyForcibly();
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            process.destroyForcibly();
        }

        // Close streams
        try {
            writer.close();
        } catch (IOException ignored) {
        }
        try {
            reader.close();
        } catch (IOException ignored) {
        }
    }

    /**
     * Checks if the client is closed.
     */
    public boolean isClosed() {
        return closed;
    }
}
