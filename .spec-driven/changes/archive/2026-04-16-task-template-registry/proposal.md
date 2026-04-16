# task-template-registry

## What
Establish a task template registry that allows saving, versioning, and instantiating task templates for collaborative agent workflows.

## Why
This is the foundational piece for milestone `10-task-team-registry`. Without reusable task templates, it is impossible to schedule tasks via cron, manage queues, or define cross-session task dependencies in a structured way.

## Scope
- Create a `TaskTemplateStore` to handle the persistence and retrieval of task templates.
- Add JSON-RPC methods for creating, reading, updating, and deleting task templates.
- Persist task templates to disk as JSON files (similar to `TemplateStore`).

## Unchanged Behavior
- The existing session template system remains unchanged.
- Agent lifecycle execution logic remains the same for now (until cron/queue integrations are built).