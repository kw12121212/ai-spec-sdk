export type PolicyResult = "allow" | "deny" | "pass";

export interface PolicyContext {
  toolName: string;
  toolInput: unknown;
  sessionId: string;
}

export interface PermissionPolicy {
  readonly name: string;
  check(context: PolicyContext): Promise<PolicyResult>;
}

export interface PolicyDescriptor {
  name: string;
  config?: Record<string, unknown>;
}

export type PolicyFactory = (config?: Record<string, unknown>) => PermissionPolicy;

const policyRegistry = new Map<string, PolicyFactory>();

export function registerPolicy(name: string, factory: PolicyFactory): void {
  policyRegistry.set(name, factory);
}

export function hasPolicy(name: string): boolean {
  return policyRegistry.has(name);
}

export function getRegisteredPolicyNames(): string[] {
  return [...policyRegistry.keys()];
}

export function resolvePolicies(descriptors: PolicyDescriptor[]): PermissionPolicy[] {
  const policies: PermissionPolicy[] = [];
  for (const desc of descriptors) {
    const factory = policyRegistry.get(desc.name);
    if (!factory) {
      throw new Error(`Unknown policy: '${desc.name}'. Registered policies: ${[...policyRegistry.keys()].join(", ") || "(none)"}`);
    }
    policies.push(factory(desc.config));
  }
  return policies;
}

export interface ChainRunResult {
  decision: "allow" | "deny" | "pass";
  deniedBy?: string;
  allowedBy?: string;
  audits: Array<{
    policyName: string;
    decision: PolicyResult;
    durationMs: number;
  }>;
}

export class PolicyChain {
  private policies: PermissionPolicy[];

  constructor(policies: PermissionPolicy[]) {
    this.policies = policies;
  }

  async run(context: PolicyContext): Promise<ChainRunResult> {
    const audits: ChainRunResult["audits"] = [];

    for (const policy of this.policies) {
      const start = performance.now();
      const result = await policy.check(context);
      const durationMs = performance.now() - start;

      if (result !== "pass") {
        audits.push({ policyName: policy.name, decision: result, durationMs });
      }

      if (result === "deny") {
        return { decision: "deny", deniedBy: policy.name, audits };
      }
      if (result === "allow") {
        return { decision: "allow", allowedBy: policy.name, audits };
      }
      // result === "pass": continue to next policy
    }

    return { decision: "pass", audits };
  }
}
