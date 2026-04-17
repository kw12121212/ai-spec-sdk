import fs from "node:fs";
import path from "node:path";
import { defaultLogger as logger } from "./logger.js";
import { Team, TeamMember, TeamMemberRole, CreateTeamParams, UpdateTeamParams, VALID_TEAM_ROLES } from "./team-types.js";

function nowIso(): string {
  return new Date().toISOString();
}

export class TeamStore {
  private teams: Map<string, Team>;
  private teamsDir: string | undefined;

  constructor(teamsDir?: string) {
    this.teams = new Map();
    this.teamsDir = teamsDir;

    if (teamsDir) {
      fs.mkdirSync(teamsDir, { recursive: true });
      this._loadFromDisk(teamsDir);
    }
  }

  private _loadFromDisk(dir: string): void {
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".json")) continue;
      try {
        const raw = fs.readFileSync(path.join(dir, file), "utf8");
        const team = JSON.parse(raw) as Team;
        if (team && typeof team.name === "string") {
          this.teams.set(team.name, team);
        }
      } catch {
        // skip corrupt files
      }
    }
  }

  private _persist(team: Team): void {
    if (!this.teamsDir) return;
    const tmpPath = path.join(this.teamsDir, `${team.name}.json.tmp`);
    const finalPath = path.join(this.teamsDir, `${team.name}.json`);
    fs.writeFileSync(tmpPath, JSON.stringify(team, null, 2), "utf8");
    fs.renameSync(tmpPath, finalPath);
  }

  create(params: CreateTeamParams): Team {
    if (this.teams.has(params.name)) {
      throw new Error(`Team already exists: ${params.name}`);
    }

    const now = nowIso();

    const members: TeamMember[] = [
      { userId: "creator", role: "owner", addedAt: now },
    ];

    if (Array.isArray(params.members)) {
      for (const m of params.members) {
        if (!members.some((existing) => existing.userId === m.userId)) {
          members.push({ userId: m.userId, role: m.role, addedAt: now });
        }
      }
    }

    const team: Team = {
      name: params.name,
      description: params.description,
      members,
      workspaces: Array.isArray(params.workspaces) ? [...params.workspaces] : [],
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    this.teams.set(params.name, team);
    this._persist(team);
    logger.info("team created", { name: params.name });
    return team;
  }

  get(name: string): Team | null {
    return this.teams.get(name) ?? null;
  }

  update(params: UpdateTeamParams): Team {
    const existing = this.teams.get(params.name);
    if (!existing) {
      throw new Error(`Team not found: ${params.name}`);
    }

    const now = nowIso();

    const team: Team = {
      ...existing,
      description: params.description !== undefined ? params.description : existing.description,
      workspaces: params.workspaces !== undefined ? [...params.workspaces] : existing.workspaces,
      version: existing.version + 1,
      updatedAt: now,
    };

    this.teams.set(params.name, team);
    this._persist(team);
    logger.info("team updated", { name: params.name, version: team.version });
    return team;
  }

  list(): Team[] {
    const all = Array.from(this.teams.values());
    return all.sort((a, b) => a.name.localeCompare(b.name));
  }

  delete(name: string): boolean {
    const existed = this.teams.has(name);
    if (existed) {
      this.teams.delete(name);
      if (this.teamsDir) {
        const filePath = path.join(this.teamsDir, `${name}.json`);
        try {
          fs.unlinkSync(filePath);
        } catch {
          // ignore errors during deletion
        }
      }
      logger.info("team deleted", { name });
    }
    return existed;
  }

  addMember(teamName: string, userId: string, role: TeamMemberRole): Team {
    const team = this.teams.get(teamName);
    if (!team) {
      throw new Error(`Team not found: ${teamName}`);
    }

    if (!VALID_TEAM_ROLES.includes(role)) {
      throw new Error(`Invalid role: ${role}. Must be one of: ${VALID_TEAM_ROLES.join(", ")}`);
    }

    if (team.members.some((m) => m.userId === userId)) {
      throw new Error(`Member already exists: ${userId}`);
    }

    const now = nowIso();
    team.members.push({ userId, role, addedAt: now });
    team.updatedAt = now;
    this._persist(team);
    logger.info("team member added", { team: teamName, userId, role });
    return team;
  }

  removeMember(teamName: string, userId: string): Team {
    const team = this.teams.get(teamName);
    if (!team) {
      throw new Error(`Team not found: ${teamName}`);
    }

    const index = team.members.findIndex((m) => m.userId === userId);
    if (index === -1) {
      throw new Error(`Member not found: ${userId}`);
    }

    team.members.splice(index, 1);
    team.updatedAt = nowIso();
    this._persist(team);
    logger.info("team member removed", { team: teamName, userId });
    return team;
  }
}
