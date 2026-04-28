import { test, expect } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { runWorkflow } from "../src/workflow.js";

test("workflow.run returns parsed verify JSON output", async () => {
  const dummyScript = path.join(os.tmpdir(), "dummy-spec-script.js");
  fs.writeFileSync(dummyScript, "console.log(JSON.stringify({ valid: true }));");
  process.env["SPEC_DRIVEN_SCRIPT"] = dummyScript;

  const fixtureWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-fixture-"));

  fs.mkdirSync(path.join(fixtureWorkspace, ".spec-driven", "changes", "demo-change", "specs"), {
    recursive: true,
  });

  fs.writeFileSync(
    path.join(fixtureWorkspace, ".spec-driven", "changes", "demo-change", "proposal.md"),
    "# demo-change\n",
  );
  fs.writeFileSync(
    path.join(fixtureWorkspace, ".spec-driven", "changes", "demo-change", "design.md"),
    "# Design: demo-change\n",
  );
  fs.writeFileSync(
    path.join(fixtureWorkspace, ".spec-driven", "changes", "demo-change", "tasks.md"),
    "# Tasks: demo-change\n\n- [ ] item\n",
  );
  fs.writeFileSync(
    path.join(fixtureWorkspace, ".spec-driven", "changes", "demo-change", "questions.md"),
    "# Questions: demo-change\n\n## Open\n\n<!-- No open questions -->\n",
  );

  fs.writeFileSync(
    path.join(
      fixtureWorkspace,
      ".spec-driven",
      "changes",
      "demo-change",
      "specs",
      "demo.md",
    ),
    "## ADDED Requirements\n\n### Requirement: Demo\nThe system MUST respond.\n",
  );

  const notifications: Array<{ method: string; params: Record<string, unknown> }> = [];
  const result = await runWorkflow(
    {
      workspace: fixtureWorkspace,
      workflow: "verify",
      args: ["demo-change"],
    },
    (method, params) => notifications.push({ method, params }),
  );

  expect(result.workflow).toBe("verify");
  expect(result.workspace).toBe(fixtureWorkspace);
  expect(result.parsed).toBeTruthy();
  expect(typeof (result.parsed as Record<string, unknown>)["valid"]).toBe("boolean");
  expect(notifications[0]!.method).toBe("bridge/progress");
  expect(notifications[0]!.params["phase"]).toBe("workflow_started");
});

test("workflow.run returns structured error when script path is invalid", async () => {
  const fixtureWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-invalid-script-"));
  const original = process.env["SPEC_DRIVEN_SCRIPT"];
  process.env["SPEC_DRIVEN_SCRIPT"] = path.join(fixtureWorkspace, "does-not-exist.js");

  try {
    try {
      await runWorkflow({
        workspace: fixtureWorkspace,
        workflow: "verify",
        args: ["missing-change"],
      });
      expect(true).toBe(false); // should not reach here
    } catch (error: unknown) {
      expect(error !== null && typeof error === "object").toBeTruthy();
      expect((error as { code?: number }).code).toBe(-32002);
    }
  } finally {
    if (original === undefined) {
      delete process.env["SPEC_DRIVEN_SCRIPT"];
    } else {
      process.env["SPEC_DRIVEN_SCRIPT"] = original;
    }
  }
});

test("workflow.run returns structured error when command execution fails", async () => {
  const dummyScript = path.join(os.tmpdir(), "failing-spec-script.js");
  fs.writeFileSync(dummyScript, "process.exit(1);");
  process.env["SPEC_DRIVEN_SCRIPT"] = dummyScript;

  const fixtureWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-workflow-fail-"));
  const notifications: Array<{ method: string; params: Record<string, unknown> }> = [];

  try {
    await runWorkflow(
      {
        workspace: fixtureWorkspace,
        workflow: "apply",
        args: [],
      },
      (method, params) => notifications.push({ method, params }),
    );
    expect(true).toBe(false); // should not reach here
  } catch (error: unknown) {
    expect(error !== null && typeof error === "object").toBeTruthy();
    expect((error as { code?: number }).code).toBe(-32003);
  }

  const phases = notifications
    .filter((item) => item.method === "bridge/progress")
    .map((item) => item.params["phase"]);
  expect(phases.includes("workflow_started")).toBeTruthy();
  expect(phases.includes("workflow_failed")).toBeTruthy();
});
