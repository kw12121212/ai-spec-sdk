import fs from "node:fs";
import path from "node:path";
import { defaultLogger as logger } from "./logger.js";

export interface SessionTemplate {
  name: string;
  createdAt: string;
  updatedAt: string;
  model?: string;
  allowedTools?: string[];
  disallowedTools?: string[];
  permissionMode?: string;
  maxTurns?: number;
  systemPrompt?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

export class TemplateStore {
  private templates: Map<string, SessionTemplate>;
  private templatesDir: string | undefined;

  constructor(templatesDir?: string) {
    this.templates = new Map();
    this.templatesDir = templatesDir;

    if (templatesDir) {
      fs.mkdirSync(templatesDir, { recursive: true });
      this._loadFromDisk(templatesDir);
    }
  }

  private _loadFromDisk(dir: string): void {
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".json")) continue;
      try {
        const raw = fs.readFileSync(path.join(dir, file), "utf8");
        const template = JSON.parse(raw) as SessionTemplate;
        if (template && typeof template.name === "string") {
          this.templates.set(template.name, template);
        }
      } catch {
        // skip corrupt files
      }
    }
  }

  private _persist(template: SessionTemplate): void {
    if (!this.templatesDir) return;
    const tmpPath = path.join(this.templatesDir, `${template.name}.json.tmp`);
    const finalPath = path.join(this.templatesDir, `${template.name}.json`);
    fs.writeFileSync(tmpPath, JSON.stringify(template), "utf8");
    fs.renameSync(tmpPath, finalPath);
  }

  create(params: Omit<SessionTemplate, "createdAt" | "updatedAt">): SessionTemplate {
    const now = nowIso();
    const existing = this.templates.get(params.name);

    const template: SessionTemplate = {
      ...params,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    this.templates.set(params.name, template);
    this._persist(template);
    logger.info("template created", { name: params.name });
    return template;
  }

  get(name: string): SessionTemplate | null {
    return this.templates.get(name) ?? null;
  }

  list(): SessionTemplate[] {
    const all = Array.from(this.templates.values());
    return all.sort((a, b) => a.name.localeCompare(b.name));
  }

  delete(name: string): boolean {
    const existed = this.templates.has(name);
    if (existed) {
      this.templates.delete(name);
      if (this.templatesDir) {
        const filePath = path.join(this.templatesDir, `${name}.json`);
        try {
          fs.unlinkSync(filePath);
        } catch {
          // ignore errors during deletion
        }
      }
      logger.info("template deleted", { name });
    }
    return existed;
  }
}
