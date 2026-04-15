import { expect, test, describe, jest } from "bun:test";
import { ApprovalStore } from "../src/approval-store.js";

describe("ApprovalStore", () => {
  test("should create and retrieve pending approvals", () => {
    const store = new ApprovalStore();
    const resolve = jest.fn();
    const reject = jest.fn();

    const approvalId = store.create("session-1", "test-tool", { arg: 1 }, resolve, reject);
    expect(approvalId).toBeDefined();
    expect(typeof approvalId).toBe("string");

    const pending = store.get(approvalId);
    expect(pending).toBeDefined();
    expect(pending?.sessionId).toBe("session-1");
    expect(pending?.toolName).toBe("test-tool");
    expect(pending?.toolInput).toEqual({ arg: 1 });
    expect(pending?.createdAt).toBeLessThanOrEqual(Date.now());
  });

  test("should resolve and remove pending approval", () => {
    const store = new ApprovalStore();
    const resolve = jest.fn();
    const reject = jest.fn();

    const approvalId = store.create("session-1", "test-tool", {}, resolve, reject);
    
    const success = store.resolve(approvalId, true);
    expect(success).toBe(true);
    expect(resolve).toHaveBeenCalledWith(true);
    expect(reject).not.toHaveBeenCalled();

    // Should be removed after resolving
    expect(store.get(approvalId)).toBeUndefined();
    
    // Resolving again should return false
    expect(store.resolve(approvalId, true)).toBe(false);
  });

  test("should reject and remove pending approval", () => {
    const store = new ApprovalStore();
    const resolve = jest.fn();
    const reject = jest.fn();

    const approvalId = store.create("session-1", "test-tool", {}, resolve, reject);
    
    const success = store.reject(approvalId, new Error("denied"));
    expect(success).toBe(true);
    expect(reject).toHaveBeenCalled();
    expect(resolve).not.toHaveBeenCalled();

    // Should be removed after rejecting
    expect(store.get(approvalId)).toBeUndefined();
  });

  test("should delete pending approval", () => {
    const store = new ApprovalStore();
    const resolve = jest.fn();
    const reject = jest.fn();

    const approvalId = store.create("session-1", "test-tool", {}, resolve, reject);
    
    const success = store.delete(approvalId);
    expect(success).toBe(true);
    expect(store.get(approvalId)).toBeUndefined();
    
    // Resolving after deletion should not call resolve
    store.resolve(approvalId, true);
    expect(resolve).not.toHaveBeenCalled();
  });
});
