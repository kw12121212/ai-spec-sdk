# Proposal: session-templates

## What

Enable users to save and reuse named session configurations (templates). Templates store commonly used session parameters (model, allowedTools, disallowedTools, permissionMode, maxTurns, systemPrompt) that can be referenced by name when starting a new session.

## Why

Users frequently start sessions with the same configuration parameters. Without templates, they must repeatedly specify the same options (model, tool restrictions, system prompts) for each session. This is error-prone and tedious. Templates provide:

- **Consistency**: Ensure sessions use validated, pre-approved configurations
- **Efficiency**: Reduce repetitive parameter specification
- **Shareability**: Named configurations can be documented and shared across teams

## Scope

### In Scope

- New JSON-RPC methods:
  - `template.create` - Save a named template with session parameters
  - `template.get` - Retrieve a template by name
  - `template.list` - List all available templates
  - `template.delete` - Remove a template
- Extend `session.start` to accept an optional `template` parameter
- Template parameters are overridden by explicit parameters passed to `session.start`
- Templates are stored persistently (alongside sessions)

### Out of Scope

- Template versioning or history
- Template sharing across workspaces (templates are global to the bridge instance)
- Template inheritance or composition
- UI for template management

### Unchanged Behavior

- All existing `session.start` calls without a `template` parameter work identically
- Session lifecycle, event streaming, and webhook delivery are unaffected
- Existing session persistence and recovery mechanisms remain unchanged
