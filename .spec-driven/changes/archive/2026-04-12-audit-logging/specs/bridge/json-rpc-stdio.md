---
implementation:
  - src/bridge.ts
tests:
  - test/bridge-audit.test.ts
---

# Delta Specification: json-rpc-stdio.md

## ADDED Requirements

### Requirement: Audit Query Method

The bridge MUST expose an `audit.query` method that retrieves audit entries matching optional filters.

Parameters:

| Parameter | Type | Required | Description |
|---|---|---|---|
| `sessionId` | string | no | Filter to a specific session |
| `category` | string | no | Filter by category (`lifecycle`, `execution`, `security`, `system`) |
| `eventType` | string | no | Filter by specific event type |
| `since` | string | no | ISO-8601 timestamp; only return entries at or after this time |
| `until` | string | no | ISO-8601 timestamp; only return entries before this time |
| `limit` | number | no | Maximum entries to return (default 100, max 500) |

The response MUST include:

| Field | Type | Description |
|---|---|---|
| `total` | number | Total matching entries (before limit is applied) |
| `entries` | array | Array of `AuditEntry` objects matching the filters |

Entries MUST be returned in reverse chronological order (newest first).

If `sessionId` is provided but no audit file exists for that session, the response MUST return `total: 0` and `entries: []`.

If both `since` and `until` are provided, only entries where `since <= timestamp < until` are included.

#### Scenario: Query all audit entries for a session
- GIVEN a session has 5 audit entries
- WHEN a client calls `audit.query` with `{ sessionId: "<id>" }`
- THEN the response returns total 5 and all 5 entries in reverse chronological order

#### Scenario: Query with category filter
- GIVEN a session has lifecycle and execution audit entries
- WHEN a client calls `audit.query` with `{ sessionId: "<id>", category: "execution" }`
- THEN only entries with category "execution" are returned

#### Scenario: Query with time range filter
- GIVEN audit entries span multiple hours
- WHEN a client calls `audit.query` with `{ since: "2026-04-12T10:00:00Z", until: "2026-04-12T11:00:00Z" }`
- THEN only entries within the time range are returned

#### Scenario: Limit caps result count
- GIVEN a session has 200 audit entries
- WHEN a client calls `audit.query` with `{ sessionId: "<id>", limit: 50 }`
- THEN total is 200 and entries contains at most 50 entries

#### Scenario: Limit max is enforced
- GIVEN a client calls `audit.query` with `{ limit: 1000 }`
- WHEN the bridge processes the request
- THEN at most 500 entries are returned

#### Scenario: Unknown session returns empty result
- GIVEN no session exists with the given ID
- WHEN a client calls `audit.query` with `{ sessionId: "nonexistent" }`
- THEN the response returns total 0 and entries [] without error

#### Scenario: Query without sessionId scans all sessions
- GIVEN multiple sessions have audit entries
- WHEN a client calls `audit.query` without sessionId
- THEN entries from all sessions are returned, merged in reverse chronological order
