# Specs

Specs describe the current state of the system — what it does, not how it was built.

## Format

```markdown
### Requirement: <name>
The system MUST/SHOULD/MAY <observable behavior>.

#### Scenario: <name>
- GIVEN <precondition>
- WHEN <action>
- THEN <expected outcome>
```

**Keywords**: MUST = required, SHOULD = recommended, MAY = optional (RFC 2119).

## Organization

Group specs by domain area. Use kebab-case directory names (e.g. `core/`, `api/`, `auth/`).

## Conventions

- Write in present tense ("the system does X")
- Describe observable behavior, not implementation details
- Keep each spec focused on one area
