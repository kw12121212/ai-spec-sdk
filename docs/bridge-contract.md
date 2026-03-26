# Bridge Contract

The bridge speaks JSON-RPC 2.0 over stdio. One JSON object per line.

## Start process

```bash
node dist/src/cli.js
```

Or via the package bin after `bun run build`:

```bash
ai-spec-bridge
```

## Capabilities request

```json
{"jsonrpc":"2.0","id":1,"method":"bridge.capabilities"}
```

Example response:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocol": "jsonrpc-2.0",
    "transport": "stdio",
    "bridgeVersion": "0.1.0",
    "notifications": {
      "progress": true,
      "sessionEvent": true
    },
    "workflows": ["init", "propose", "modify", "apply", "verify", "archive", "cancel", "list"],
    "skills": ["spec-driven-brainstorm", "spec-driven-init", "spec-driven-propose", "spec-driven-modify", "spec-driven-spec-content", "spec-driven-apply", "spec-driven-verify", "spec-driven-review", "spec-driven-archive", "spec-driven-cancel", "spec-driven-auto"],
    "methods": ["bridge.capabilities", "workflow.run", "skills.list", "session.start", "session.resume", "session.stop", "session.status"]
  }
}
```

## Workflow request

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "workflow.run",
  "params": {
    "workspace": "/path/to/project",
    "workflow": "verify",
    "args": ["add-polyglot-agent-spec-bridge"]
  }
}
```

You may receive progress notifications before the final response:

```json
{"jsonrpc":"2.0","method":"bridge/progress","params":{"phase":"workflow_started","workflow":"verify","workspace":"/path/to/project","requestId":2}}
```

## Session request

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "session.start",
  "params": {
    "workspace": "/path/to/project",
    "prompt": "Summarize this repository",
    "options": {
      "allowedTools": ["Read", "Glob"]
    }
  }
}
```

The bridge emits `bridge/session_event` notifications and returns final result when complete.

## Error response examples

Invalid JSON-RPC request object:

```json
{
  "jsonrpc": "2.0",
  "id": 99,
  "error": {
    "code": -32600,
    "message": "Invalid JSON-RPC request"
  }
}
```

Unknown method:

```json
{
  "jsonrpc": "2.0",
  "id": 100,
  "error": {
    "code": -32601,
    "message": "Method not found: unknown.method"
  }
}
```

Workflow execution failure:

```json
{
  "jsonrpc": "2.0",
  "id": 101,
  "error": {
    "code": -32003,
    "message": "Workflow execution failed",
    "data": {
      "workflow": "verify",
      "workspace": "/path/to/project"
    }
  }
}
```

## Python subprocess example

```python
import json
import subprocess

proc = subprocess.Popen(
    ["node", "dist/src/cli.js"],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    text=True,
)

request_obj = {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "bridge.capabilities",
}

proc.stdin.write(json.dumps(request_obj) + "\n")
proc.stdin.flush()

response_line = proc.stdout.readline()
response = json.loads(response_line)
print(response)
```
