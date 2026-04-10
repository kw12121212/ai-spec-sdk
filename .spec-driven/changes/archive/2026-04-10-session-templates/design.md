# Design: session-templates

## Approach

### 1. Template Store

Create a new `TemplateStore` class similar to `SessionStore`:
- Stores templates as JSON files in a `templates/` subdirectory alongside sessions
- In-memory cache with disk persistence
- Template ID is the user-provided name (string), not a UUID

### 2. Template Structure

```typescript
interface SessionTemplate {
  name: string;                    // Unique identifier (user-provided)
  createdAt: string;               // ISO timestamp
  updatedAt: string;               // ISO timestamp
  // Session parameters (all optional)
  model?: string;
  allowedTools?: string[];
  disallowedTools?: string[];
  permissionMode?: string;
  maxTurns?: number;
  systemPrompt?: string;
}
```

### 3. JSON-RPC Methods

#### `template.create`
- Parameters: `name` (string, required), plus any session control parameters
- Creates or updates a template
- Returns the created template
- Error `-32602` if name is missing or invalid
- Error `-32020` if template name already exists (optional strict mode)

#### `template.get`
- Parameters: `name` (string, required)
- Returns the template or null if not found

#### `template.list`
- Parameters: none
- Returns array of all templates (sorted by name)

#### `template.delete`
- Parameters: `name` (string, required)
- Removes the template
- Returns success boolean

### 4. Session Start Integration

Modify `session.start`:
- Accept optional `template` parameter (string, template name)
- If template exists: load its parameters as defaults
- Explicit parameters in the request override template values
- Error `-32021` if template name is provided but not found

### 5. Parameter Merge Logic

```typescript
const templateParams = template ? await templateStore.get(template) : {};
const finalParams = {
  ...templateParams,           // Template defaults
  ...explicitParams,           // Request overrides (excluding undefined)
};
```

## Key Decisions

1. **Template names are user-defined strings**, not UUIDs. This makes them memorable and documentation-friendly.

2. **Templates are global**, not workspace-scoped. This matches the pattern of `config` and `hooks` which are also bridge-global.

3. **Create is upsert by default**. Calling `template.create` with an existing name updates the template. This simplifies workflows.

4. **No template versioning**. Users can use naming conventions (e.g., `my-config-v2`) if needed.

5. **Template storage uses same persistence mechanism as sessions** (JSON files on disk) for operational simplicity.

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Workspace-scoped templates | Adds complexity; global templates match existing config/hooks pattern |
| Template inheritance/composition | Overkill for v1; can be added later if needed |
| Separate template file format | JSON is consistent with session storage and sufficient |
| Template versioning built-in | Adds UI and storage complexity; naming conventions suffice |
