export interface TaskTemplate {
  name: string;
  description?: string;
  systemPrompt?: string;
  tools?: string[];
  parameters?: Record<string, any>;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskTemplateParams {
  name: string;
  description?: string;
  systemPrompt?: string;
  tools?: string[];
  parameters?: Record<string, any>;
}

export interface UpdateTaskTemplateParams {
  name: string;
  description?: string;
  systemPrompt?: string;
  tools?: string[];
  parameters?: Record<string, any>;
}
