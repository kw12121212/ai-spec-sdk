import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { HttpTransport } from "../src/http-transport.js";
import { BridgeClientError } from "../src/errors.js";

describe("HttpTransport", () => {
  let transport: HttpTransport;

  beforeEach(() => {
    transport = new HttpTransport({ url: "http://localhost:9999" });
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

  test("request() throws with correct error code when closed", async () => {
    transport.close();
    try {
      await transport.request("bridge.ping");
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(BridgeClientError);
      expect((err as BridgeClientError).code).toBe(-32603);
    }
  });

  test("close() cleans up resources", () => {
    transport.close();
    // Calling close again should be safe
    transport.close();
    expect(transport.isClosed).toBe(true);
  });

  test("notification handlers can be registered", () => {
    const handler = () => {};
    transport.onNotification(handler);
    // No error means success
  });

  test("close() is idempotent", () => {
    transport.close();
    transport.close();
    expect(transport.isClosed).toBe(true);
  });
});
