# Design: Task Template Registry

## Approach
We will introduce a `TaskTemplateStore` class that closely mirrors the existing `TemplateStore` used for session templates, but is dedicated to `TaskTemplate` objects. This store will manage reading and writing JSON files to a dedicated `task-templates` directory on disk. We will expose JSON-RPC endpoints on the bridge to interact with the store.

## Key Decisions
- **Storage Mechanism**: Disk-based JSON storage, chosen to align with the current pattern for session templates and to keep external dependencies low.
- **Model Structure**: The `TaskTemplate` model will include fields such as `name`, `description`, `systemPrompt`, `tools`, `parameters` (JSON Schema), and `version`.

## Alternatives Considered
- **In-Memory Storage**: Rejected as task templates need to persist across agent restarts to enable scheduled workflows.
- **External Database (e.g., SQLite, PostgreSQL)**: Rejected as it introduces heavy external dependencies that are unnecessary for the current SDK scope. We stick with the file-based approach currently used in the project.