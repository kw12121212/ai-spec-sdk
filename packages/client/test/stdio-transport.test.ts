import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { StdioTransport } from "../src/stdio-transport.js";
import { BridgeClientError } from "../src/errors.js";

describe("StdioTransport", () => {
  let transport: StdioTransport;

  beforeEach(() => {
    transport = new StdioTransport();
  });

  afterEach(() => {
    transport.close();
  });

  test("isClosed is false initially", () => {
    expect(transport.isClosed).toBe(false);
  });

  test("close() sets isClosed to true", () => {
    transport.close();
    expect(transport.isClosed).toBe(true);
  });

  test("request() throws if transport is closed", async () => {
    transport.close();
    expect(transport.request("bridge.ping")).rejects.toThrow("Transport is closed");
  });

  test("request() rejects with BridgeClientError when closed", async () => {
    transport.close();
    try {
      await transport.request("bridge.ping");
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(BridgeClientError);
      expect((err as BridgeClientError).code).toBe(-32603);
    }
  });

  test("notification handlers can be registered", () => {
    const handler = () => {};
    transport.onNotification(handler);
    // No error means success
  });

  test("close() is idempotent", () => {
    transport.close();
    transport.close(); // should not throw
    expect(transport.isClosed).toBe(true);
  });
});
