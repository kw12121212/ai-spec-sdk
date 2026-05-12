import { test, expect, describe, beforeEach } from "bun:test";
import { LoopController } from "../../src/workflow/loop-controller.js";

describe("LoopController", () => {
  let controller: LoopController;

  beforeEach(() => {
    controller = new LoopController();
  });

  test("initial state is inactive", () => {
    expect(controller.getState()).toBe("inactive");
  });

  test("start transitions to active", () => {
    controller.start();
    expect(controller.getState()).toBe("active");
  });

  test("cannot start from active", () => {
    controller.start();
    expect(() => controller.start()).toThrow("Cannot start loop from state: active");
  });

  test("cannot pause from inactive", () => {
    expect(() => controller.pause()).toThrow("Cannot pause loop from state: inactive");
  });

  test("pause transitions to paused", () => {
    controller.start();
    controller.pause();
    expect(controller.getState()).toBe("paused");
  });

  test("resume transitions to active", () => {
    controller.start();
    controller.pause();
    controller.resume();
    expect(controller.getState()).toBe("active");
  });

  test("cannot resume from inactive", () => {
    expect(() => controller.resume()).toThrow("Cannot resume loop from state: inactive");
  });

  test("cannot resume from active", () => {
    controller.start();
    expect(() => controller.resume()).toThrow("Cannot resume loop from state: active");
  });

  test("stop transitions to inactive", () => {
    controller.start();
    controller.stop();
    expect(controller.getState()).toBe("inactive");
  });

  test("cannot stop from inactive", () => {
    expect(() => controller.stop()).toThrow("Cannot stop loop from state: inactive");
  });
});
