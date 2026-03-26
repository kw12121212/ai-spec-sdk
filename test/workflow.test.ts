import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { runWorkflow } from "../src/workflow.js";

test("workflow.run returns parsed verify JSON output", async () => {
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

  assert.equal(result.workflow, "verify");
  assert.equal(result.workspace, fixtureWorkspace);
  assert.ok(result.parsed);
  assert.equal(typeof (result.parsed as Record<string, unknown>)["valid"], "boolean");
  assert.equal(notifications[0]!.method, "bridge/progress");
  assert.equal(notifications[0]!.params["phase"], "workflow_started");
});

test("workflow.run returns structured error when script path is invalid", async () => {
  const fixtureWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-invalid-script-"));
  const original = process.env["SPEC_DRIVEN_SCRIPT"];
  process.env["SPEC_DRIVEN_SCRIPT"] = path.join(fixtureWorkspace, "does-not-exist.js");

  try {
    await assert.rejects(
      runWorkflow({
        workspace: fixtureWorkspace,
        workflow: "verify",
        args: ["missing-change"],
      }),
      (error: unknown) =>
        error !== null &&
        typeof error === "object" &&
        (error as { code?: number }).code === -32002,
    );
  } finally {
    if (original === undefined) {
      delete process.env["SPEC_DRIVEN_SCRIPT"];
    } else {
      process.env["SPEC_DRIVEN_SCRIPT"] = original;
    }
  }
});

test("workflow.run returns structured error when command execution fails", async () => {
  const fixtureWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-workflow-fail-"));
  const notifications: Array<{ method: string; params: Record<string, unknown> }> = [];

  await assert.rejects(
    runWorkflow(
      {
        workspace: fixtureWorkspace,
        workflow: "apply",
        args: [],
      },
      (method, params) => notifications.push({ method, params }),
    ),
    (error: unknown) =>
      error !== null &&
      typeof error === "object" &&
      (error as { code?: number }).code === -32003,
  );

  const phases = notifications
    .filter((item) => item.method === "bridge/progress")
    .map((item) => item.params["phase"]);
  assert.ok(phases.includes("workflow_started"));
  assert.ok(phases.includes("workflow_failed"));
});
