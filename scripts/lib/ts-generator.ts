import * as fs from "fs";
import * as path from "path";
import {
  ParsedContract,
  ContractMethod,
  ContractField,
  ContractErrorCode,
} from "./contract-parser.js";

export function generateTypeScriptTypes(
  contract: ParsedContract,
  outputPath: string
): void {
  const lines: string[] = [];

  // Header
  lines.push("// AUTO-GENERATED from bridge-contract.yaml");
  lines.push("// Do not edit manually. Run `bun run generate:types` to regenerate.");
  lines.push(`// Generated at: ${new Date().toISOString()}`);
  lines.push("");

  // Common types
  lines.push("// ── Common ──────────────────────────────────────────────────────────────────");
  lines.push("");
  lines.push('export interface JsonRpcRequest {');
  lines.push('  jsonrpc: "2.0";');
  lines.push('  id: string | number | null;');
  lines.push('  method: string;');
  lines.push('  params?: Record<string, unknown>;');
  lines.push('}');
  lines.push("");
  lines.push('export interface JsonRpcResponse {');
  lines.push('  jsonrpc: "2.0";');
  lines.push('  id: string | number | null;');
  lines.push('  result?: unknown;');
  lines.push('  error?: { code: number; message: string; data?: unknown };');
  lines.push('}');
  lines.push("");
  lines.push('export interface JsonRpcNotification {');
  lines.push('  jsonrpc: "2.0";');
  lines.push('  method: string;');
  lines.push('  params: Record<string, unknown>;');
  lines.push('}');
  lines.push("");

  // Method params and results
  lines.push("// ── Method Params and Results ───────────────────────────────────────────────");
  lines.push("");

  for (const method of contract.methods) {
    const interfaceName = methodNameToInterfaceName(method.name);

    // Generate params interface
    if (method.params && Object.keys(method.params).length > 0) {
      lines.push(`export interface ${interfaceName}Params {`);
      for (const [fieldName, fieldDef] of Object.entries(method.params)) {
        const tsType = contractFieldToTsType(fieldDef);
        const optional = fieldDef.required === false ? "?" : "";
        lines.push(`  ${fieldName}${optional}: ${tsType};`);
      }
      lines.push("}");
      lines.push("");
    }

    // Generate result interface
    if (method.result) {
      if ("type" in method.result && method.result.type === "object" && method.result.fields) {
        lines.push(`export interface ${interfaceName}Result {`);
        for (const [fieldName, fieldDef] of Object.entries(method.result.fields)) {
          const tsType = contractFieldToTsType(fieldDef);
          const optional = fieldDef.required === false ? "?" : "";
          lines.push(`  ${fieldName}${optional}: ${tsType};`);
        }
        lines.push("}");
        lines.push("");
      } else if (typeof method.result === "object") {
        lines.push(`export interface ${interfaceName}Result {`);
        for (const [fieldName, fieldDef] of Object.entries(method.result)) {
          const tsType = contractFieldToTsType(fieldDef as ContractField);
          const optional = (fieldDef as ContractField).required === false ? "?" : "";
          lines.push(`  ${fieldName}${optional}: ${tsType};`);
        }
        lines.push("}");
        lines.push("");
      }
    }
  }

  // Error types
  lines.push("// ── Error Types ──────────────────────────────────────────────────────────────");
  lines.push("");
  lines.push("export interface JsonRpcError {");
  lines.push("  code: number;");
  lines.push("  message: string;");
  lines.push("  data?: unknown;");
  lines.push("}");
  lines.push("");

  for (const error of contract.errorCodes) {
    if (error.data && Object.keys(error.data).length > 0) {
      const interfaceName = `${error.name}ErrorData`;
      lines.push(`export interface ${interfaceName} {`);
      for (const [fieldName, fieldDef] of Object.entries(error.data)) {
        const tsType = contractFieldToTsType(fieldDef);
        const optional = fieldDef.required === false ? "?" : "";
        lines.push(`  ${fieldName}${optional}: ${tsType};`);
      }
      lines.push("}");
      lines.push("");
    }
  }

  // Notification types
  lines.push("// ── Notification Types ───────────────────────────────────────────────────────");
  lines.push("");
  lines.push('export type NotificationMethod =');
  const notifMethods = contract.notifications.map((n) => `  | "${n.method}"`);
  lines.push(...notifMethods);
  lines.push("  ;");
  lines.push("");

  // Write file
  fs.writeFileSync(outputPath, lines.join("\n"), "utf-8");
}

function methodNameToInterfaceName(methodName: string): string {
  // Convert method.name like "session.start" to "SessionStart"
  return methodName
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function contractFieldToTsType(field: ContractField): string {
  let type: string;

  if (field.enum && field.enum.length > 0) {
    type = field.enum.map((v) => `"${v}"`).join(" | ");
  } else if (field.type === "array" && field.items) {
    const elementType = contractFieldToTsType(field.items as unknown as ContractField);
    type = `${elementType}[]`;
  } else if (field.type === "object") {
    if (field.fields) {
      const fieldTypes = Object.entries(field.fields)
        .map(([k, v]) => `${k}: ${contractFieldToTsType(v)}`)
        .join("; ");
      type = `{ ${fieldTypes} }`;
    } else {
      type = "Record<string, unknown>";
    }
  } else {
    const primitiveMap: Record<string, string> = {
      string: "string",
      number: "number",
      boolean: "boolean",
      null: "null",
    };
    type = primitiveMap[field.type] || "unknown";
  }

  if (field.nullable) {
    type = `${type} | null`;
  }

  return type;
}
