import fs from "node:fs";
import path from "node:path";
import { defaultLogger as logger } from "./logger.js";
import { TaskTemplate, CreateTaskTemplateParams, UpdateTaskTemplateParams } from "./task-template-types.js";

function nowIso(): string {
  return new Date().toISOString();
}

export class TaskTemplateStore {
  private templates: Map<string, TaskTemplate>;
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
        const template = JSON.parse(raw) as TaskTemplate;
        if (template && typeof template.name === "string") {
          this.templates.set(template.name, template);
        }
      } catch {
        // skip corrupt files
      }
    }
  }

  private _persist(template: TaskTemplate): void {
    if (!this.templatesDir) return;
    const tmpPath = path.join(this.templatesDir, `${template.name}.json.tmp`);
    const finalPath = path.join(this.templatesDir, `${template.name}.json`);
    fs.writeFileSync(tmpPath, JSON.stringify(template, null, 2), "utf8");
    fs.renameSync(tmpPath, finalPath);
  }

  create(params: CreateTaskTemplateParams): TaskTemplate {
    if (this.templates.has(params.name)) {
      throw new Error(`Task template already exists: ${params.name}`);
    }

    const now = nowIso();

    const template: TaskTemplate = {
      ...params,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    this.templates.set(params.name, template);
    this._persist(template);
    logger.info("task template created", { name: params.name });
    return template;
  }

  get(name: string): TaskTemplate | null {
    return this.templates.get(name) ?? null;
  }

  update(params: UpdateTaskTemplateParams): TaskTemplate {
    const existing = this.templates.get(params.name);
    if (!existing) {
      throw new Error(`Task template not found: ${params.name}`);
    }

    const now = nowIso();

    const template: TaskTemplate = {
      ...existing,
      ...params,
      version: existing.version + 1,
      updatedAt: now,
    };

    this.templates.set(params.name, template);
    this._persist(template);
    logger.info("task template updated", { name: params.name, version: template.version });
    return template;
  }

  list(): TaskTemplate[] {
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
      logger.info("task template deleted", { name });
    }
    return existed;
  }
}
