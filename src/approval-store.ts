export interface PendingApproval {
  approvalId: string;
  sessionId: string;
  toolName: string;
  toolInput: unknown;
  resolve: (value: boolean) => void;
  reject: (reason?: any) => void;
  createdAt: number;
}

export class ApprovalStore {
  public approvals: Map<string, PendingApproval> = new Map();

  create(
    sessionId: string,
    toolName: string,
    toolInput: unknown,
    resolve: (value: boolean) => void,
    reject: (reason?: any) => void
  ): string {
    const approvalId = crypto.randomUUID();
    const approval: PendingApproval = {
      approvalId,
      sessionId,
      toolName,
      toolInput,
      resolve,
      reject,
      createdAt: Date.now(),
    };
    this.approvals.set(approvalId, approval);
    return approvalId;
  }

  get(approvalId: string): PendingApproval | undefined {
    return this.approvals.get(approvalId);
  }

  resolve(approvalId: string, approved: boolean): boolean {
    const approval = this.approvals.get(approvalId);
    if (!approval) {
      return false;
    }
    
    this.approvals.delete(approvalId);
    approval.resolve(approved);
    return true;
  }

  reject(approvalId: string, reason?: any): boolean {
    const approval = this.approvals.get(approvalId);
    if (!approval) {
      return false;
    }
    
    this.approvals.delete(approvalId);
    approval.reject(reason);
    return true;
  }

  delete(approvalId: string): boolean {
    return this.approvals.delete(approvalId);
  }
}
