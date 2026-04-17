export interface TeamMember {
  userId: string;
  role: TeamMemberRole;
  addedAt: string;
}

export type TeamMemberRole = "owner" | "admin" | "member";

export const VALID_TEAM_ROLES: readonly TeamMemberRole[] = ["owner", "admin", "member"];

export interface Team {
  name: string;
  description?: string;
  members: TeamMember[];
  workspaces: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTeamParams {
  name: string;
  description?: string;
  members?: Array<{ userId: string; role: TeamMemberRole }>;
  workspaces?: string[];
}

export interface UpdateTeamParams {
  name: string;
  description?: string;
  workspaces?: string[];
}
