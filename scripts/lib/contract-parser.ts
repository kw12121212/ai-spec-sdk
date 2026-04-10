import * as yaml from "js-yaml";
import * as fs from "fs";
import * as path from "path";

export interface ContractMethod {
  name: string;
  description: string;
  params?: Record<string, ContractField>;
  result?: Record<string, ContractField> | { type: string; fields?: Record<string, ContractField> };
}

export interface ContractField {
  type: string;
  items?: ContractType;
  enum?: string[];
  required?: boolean;
  nullable?: boolean;
  fields?: Record<string, ContractField>;
  description?: string;
}

export interface ContractType {
  type: string;
  items?: ContractType;
  enum?: string[];
}

export interface ParsedContract {
  methods: ContractMethod[];
  notifications: ContractNotification[];
  errorCodes: ContractErrorCode[];
}

export interface ContractNotification {
  method: string;
  params?: Record<string, ContractField>;
}

export interface ContractErrorCode {
  code: number;
  name: string;
  message: string;
  data?: Record<string, ContractField>;
}

export function parseContract(contractPath: string): ParsedContract {
  const content = fs.readFileSync(contractPath, "utf-8");
  // Use JSON_SCHEMA schema and allow duplicate keys (later values override earlier ones)
  const doc = yaml.load(content, {
    schema: yaml.JSON_SCHEMA,
    json: true,
  }) as Record<string, unknown>;

  const methods: ContractMethod[] = [];
  const notifications: ContractNotification[] = [];
  const errorCodes: ContractErrorCode[] = [];

  // Parse methods
  if (doc.methods && typeof doc.methods === "object") {
    for (const [name, methodDef] of Object.entries(doc.methods)) {
      if (name.startsWith("_") || name === "description") continue;

      const method = methodDef as Record<string, unknown>;
      const parsedMethod: ContractMethod = {
        name,
        description: (method.description as string) || "",
      };

      if (method.params && typeof method.params === "object") {
        parsedMethod.params = method.params as Record<string, ContractField>;
      }

      if (method.result && typeof method.result === "object") {
        parsedMethod.result = method.result as Record<string, ContractField>;
      }

      methods.push(parsedMethod);
    }
  }

  // Parse notifications from envelope
  if (doc.envelope?.notification?.params && typeof doc.envelope.notification.params === "object") {
    const notifParams = doc.envelope.notification.params as Record<string, unknown>;
    if (notifParams.method?.enum && Array.isArray(notifParams.method.enum)) {
      for (const methodName of notifParams.method.enum) {
        notifications.push({
          method: methodName as string,
        });
      }
    }
  }

  // Parse error codes
  if (doc.error_codes && typeof doc.error_codes === "object") {
    for (const [code, errorDef] of Object.entries(doc.error_codes)) {
      const error = errorDef as Record<string, unknown>;
      const parsedError: ContractErrorCode = {
        code: parseInt(code, 10),
        name: (error.name as string) || "",
        message: (error.message as string) || "",
      };

      if (error.data && typeof error.data === "object") {
        parsedError.data = error.data as Record<string, ContractField>;
      }

      errorCodes.push(parsedError);
    }
  }

  return { methods, notifications, errorCodes };
}
