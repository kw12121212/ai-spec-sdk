import { describe, it, expect, mock, beforeEach, afterEach, jest } from "bun:test";
import { LoadBalancer } from "../src/llm-provider/load-balancer.js";

describe("LoadBalancer", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("should do round-robin rotation", () => {
    const lb = new LoadBalancer({
      id: "lb1",
      strategy: "round-robin",
      providerIds: ["p1", "p2", "p3"],
    });

    expect(lb.next()).toBe("p1");
    expect(lb.next()).toBe("p2");
    expect(lb.next()).toBe("p3");
    expect(lb.next()).toBe("p1");
  });

  it("should do weighted selection", () => {
    const lb = new LoadBalancer({
      id: "lb2",
      strategy: "weighted",
      providerIds: ["p1", "p2"],
      weights: [3, 1],
    });

    const origRandom = Math.random;
    try {
      Math.random = () => 0.1; // 0.1 * 4 = 0.4 <= 3 -> p1
      expect(lb.next()).toBe("p1");

      Math.random = () => 0.8; // 0.8 * 4 = 3.2 > 3 -> p2
      expect(lb.next()).toBe("p2");
    } finally {
      Math.random = origRandom;
    }
  });

  it("should reactively exclude after failure and re-admit after cool-down", () => {
    const onExcluded = mock();
    const onReadmitted = mock();

    const lb = new LoadBalancer(
      {
        id: "lb3",
        strategy: "round-robin",
        providerIds: ["p1", "p2"],
        coolDownMs: 1000,
      },
      { onExcluded, onReadmitted },
    );

    expect(lb.next()).toBe("p1");
    
    lb.exclude("p2", "error");
    expect(onExcluded).toHaveBeenCalledWith("p2", "error", expect.any(String));

    expect(lb.next()).toBe("p1");
    expect(lb.next()).toBe("p1");

    jest.advanceTimersByTime(1001);

    expect(onReadmitted).toHaveBeenCalledWith("p2");
    expect(lb.next()).toBe("p2");
  });

  it("should handle all-excluded edge case", () => {
    const lb = new LoadBalancer({
      id: "lb4",
      strategy: "round-robin",
      providerIds: ["p1"],
    });

    expect(lb.next()).toBe("p1");
    lb.exclude("p1", "error");
    
    expect(lb.next()).toBe(null);
  });
});
