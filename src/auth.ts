import crypto from "node:crypto";
import type { StoredKey } from "./key-store.js";
import { roleStore } from "./role-store.js";

export function generateKey(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, hash };
}

/** Returns the matching StoredKey if the token is valid and not expired; null otherwise. */
export function verifyKey(token: string, keys: StoredKey[]): StoredKey | null {
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const key = keys.find((k) => k.hash === hash) ?? null;
  if (!key) return null;
  if (key.expiresAt) {
    const expiresAt = new Date(key.expiresAt);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) return null;
  }
  return key;
}

/** null = no authentication required for this method */
export const METHOD_SCOPES: Record<string, string | null> = {
  // No auth required
  "bridge.capabilities": null,
  "bridge.ping": null,
  "bridge.negotiateVersion": null,
  "models.list": null,
  "tools.list": null,
  "skills.list": null,
  // Session write
  "session.start": "session:write",
  "session.spawn": "session:write",
  "session.resume": "session:write",
  "session.pause": "session:write",
  "session.stop": "session:write",
  "session.cancel": "session:write",
  "session.delete": "session:write",
  "session.cleanup": "session:write",
  "session.approveTool": "session:write",
  "session.rejectTool": "session:write",
  "session.answerQuestion": "session:write",
  "session.branch": "session:write",
  "session.setProvider": "session:write",
  "stream.pause": "session:write",
  "stream.resume": "session:write",
  "stream.throttle": "session:write",
  "stream.backpressure": "session:write",
  // Session read
  "session.status": "session:read",
  "session.list": "session:read",
  "session.history": "session:read",
  "session.events": "session:read",
  "session.export": "session:read",
  "session.search": "session:read",
  // Workflow
  "workflow.run": "workflow:run",
  // Loop control
  "loop.start": "loop:control",
  "loop.pause": "loop:control",
  "loop.resume": "loop:control",
  "loop.stop": "loop:control",
  // Config read
  "config.get": "config:read",
  "config.list": "config:read",
  "context.read": "config:read",
  "context.list": "config:read",
  // Config write
  "config.set": "config:write",
  "context.write": "config:write",
  "workspace.register": "config:write",
  "workspace.list": "config:write",
  "tools.register": "config:write",
  "tools.unregister": "config:write",
  "template.create": "config:write",
  "template.get": "config:read",
  "template.list": "config:read",
  "template.delete": "config:write",
  "taskTemplate.create": "config:write",
  "taskTemplate.get": "config:read",
  "taskTemplate.update": "config:write",
  "taskTemplate.list": "config:read",
  "taskTemplate.delete": "config:write",
  // Admin
  "mcp.add": "admin",
  "mcp.remove": "admin",
  "mcp.start": "admin",
  "mcp.stop": "admin",
  "mcp.list": "admin",
  "hooks.add": "admin",
  "hooks.remove": "admin",
  "hooks.list": "admin",
  "bridge.setLogLevel": "admin",
  "bridge.info": "admin",
  "webhook.subscribe": "admin",
  "webhook.unsubscribe": "admin",
  "bridge.approveTool": "admin",
  "bridge.denyTool": "admin",
  "team.create": "admin",
  "team.get": "admin",
  "team.update": "admin",
  "team.delete": "admin",
  "team.list": "admin",
  "team.addMember": "admin",
  "team.removeMember": "admin",
  "audit.query": "admin",
  "provider.register": "admin",
  "provider.list": "admin",
  "provider.get": "admin",
  "provider.update": "admin",
  "provider.remove": "admin",
  "provider.setDefault": "admin",
  "provider.getDefault": "admin",
  "provider.healthCheck": "admin",
  "provider.getFallbackChain": "admin",
  "provider.switch": "admin",
  "token.getUsage": "admin",
  "token.getSessionSummary": "admin",
  "token.getMessageUsage": "admin",
  "token.getProviderUsage": "admin",
  "token.clearAll": "admin",
  "token.registerCounter": "admin",
  "token.listCounters": "admin",
  "quota.set": "admin",
  "quota.get": "admin",
  "quota.list": "admin",
  "quota.remove": "admin",
  "quota.clear": "admin",
  "quota.getStatus": "admin",
  "quota.getViolations": "admin",
  "budget.create": "admin",
  "budget.get": "admin",
  "budget.list": "admin",
  "budget.adjust": "admin",
  "budget.remove": "admin",
  "budget.getStatus": "admin",
  "balancer.create": "admin",
  "balancer.remove": "admin",
  "balancer.list": "admin",
  "balancer.status": "admin",
  "permissions.scopes": "admin",
  "permissions.policies.list": "admin",
};

/**
 * Returns true if the key is authorized to call the given method.
 * Methods with null scope always return true (no auth required).
 * A key with "admin" scope passes all checks.
 * Unknown methods default to requiring "admin" scope.
 */
export function checkScope(key: StoredKey, method: string): boolean {
  const required = method in METHOD_SCOPES ? METHOD_SCOPES[method] : "admin";
  if (required === null) return true;
  
  const effectiveScopes = new Set(key.scopes);
  if (key.roles && key.roles.length > 0) {
    const roleScopes = roleStore.resolveRoles(key.roles);
    for (const s of roleScopes) effectiveScopes.add(s);
  }

  return effectiveScopes.has("admin") || effectiveScopes.has(required as string);
}
