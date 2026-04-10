import * as fs from "fs";
import * as path from "path";
import {
  ParsedContract,
  ContractMethod,
  ContractField,
  ContractErrorCode,
} from "./contract-parser.js";

export function generatePythonTypes(
  contract: ParsedContract,
  outputPath: string
): void {
  const lines: string[] = [];

  // Header
  lines.push("# AUTO-GENERATED from bridge-contract.yaml");
  lines.push("# Do not edit manually. Run type generator to regenerate.");
  lines.push(`# Generated at: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("from __future__ import annotations");
  lines.push("");
  lines.push("from dataclasses import dataclass, field");
  lines.push("from typing import Any, Literal");
  lines.push("");

  // Common types
  lines.push("# ── Common ──────────────────────────────────────────────────────────────────");
  lines.push("");
  lines.push("@dataclass");
  lines.push("class JsonRpcRequest:");
  lines.push('    jsonrpc: Literal["2.0"]');
  lines.push("    id: str | int | None");
  lines.push("    method: str");
  lines.push("    params: dict[str, Any] | None = None");
  lines.push("");
  lines.push("@dataclass");
  lines.push("class JsonRpcResponse:");
  lines.push('    jsonrpc: Literal["2.0"]');
  lines.push("    id: str | int | None");
  lines.push("    result: Any | None = None");
  lines.push("    error: JsonRpcError | None = None");
  lines.push("");
  lines.push("@dataclass");
  lines.push("class JsonRpcNotification:");
  lines.push('    jsonrpc: Literal["2.0"]');
  lines.push("    method: str");
  lines.push("    params: dict[str, Any]");
  lines.push("");

  // Method params
  lines.push("# ── Method Params ────────────────────────────────────────────────────────────");
  lines.push("");

  for (const method of contract.methods) {
    if (method.params && Object.keys(method.params).length > 0) {
      const className = methodNameToClassName(method.name) + "Params";
      lines.push("@dataclass");
      lines.push(`class ${className}:`);

      for (const [fieldName, fieldDef] of Object.entries(method.params)) {
        const pyType = contractFieldToPyType(fieldDef);
        const defaultValue = getPythonDefaultValue(fieldDef);
        lines.push(`    ${fieldName}: ${pyType}${defaultValue}`);
      }
      lines.push("");
    }
  }

  // Method results
  lines.push("# ── Method Results ───────────────────────────────────────────────────────────");
  lines.push("");

  for (const method of contract.methods) {
    if (method.result) {
      const className = methodNameToClassName(method.name) + "Result";
      lines.push("@dataclass");
      lines.push(`class ${className}:`);

      let fields: Record<string, ContractField> = {};
      if ("type" in method.result && method.result.type === "object" && method.result.fields) {
        fields = method.result.fields;
      } else if (typeof method.result === "object") {
        fields = method.result as Record<string, ContractField>;
      }

      if (Object.keys(fields).length > 0) {
        for (const [fieldName, fieldDef] of Object.entries(fields)) {
          const pyType = contractFieldToPyType(fieldDef);
          const defaultValue = getPythonDefaultValue(fieldDef);
          lines.push(`    ${fieldName}: ${pyType}${defaultValue}`);
        }
      } else {
        lines.push("    pass");
      }
      lines.push("");
    }
  }

  // Error types
  lines.push("# ── Error Types ──────────────────────────────────────────────────────────────");
  lines.push("");
  lines.push("@dataclass");
  lines.push("class JsonRpcError:");
  lines.push("    code: int");
  lines.push("    message: str");
  lines.push("    data: Any | None = None");
  lines.push("");

  for (const error of contract.errorCodes) {
    if (error.data && Object.keys(error.data).length > 0) {
      const className = error.name + "ErrorData";
      lines.push("@dataclass");
      lines.push(`class ${className}:`);
      for (const [fieldName, fieldDef] of Object.entries(error.data)) {
        const pyType = contractFieldToPyType(fieldDef);
        const defaultValue = getPythonDefaultValue(fieldDef);
        lines.push(`    ${fieldName}: ${pyType}${defaultValue}`);
      }
      lines.push("");
    }
  }

  // Notification types
  lines.push("# ── Notification Types ───────────────────────────────────────────────────────");
  lines.push("");
  lines.push('NotificationMethod = Literal[');
  const notifMethods = contract.notifications.map((n) => `    "${n.method}"`);
  lines.push(...notifMethods);
  lines.push("]");
  lines.push("");

  // Write file
  fs.writeFileSync(outputPath, lines.join("\n"), "utf-8");
}

function methodNameToClassName(methodName: string): string {
  // Convert method.name like "session.start" to "SessionStart"
  return methodName
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function contractFieldToPyType(field: ContractField): string {
  let type: string;

  if (field.enum && field.enum.length > 0) {
    type = `Literal[${field.enum.map((v) => `"${v}"`).join(", ")}]`;
  } else if (field.type === "array" && field.items) {
    const elementType = contractFieldToPyType(field.items as unknown as ContractField);
    type = `list[${elementType}]`;
  } else if (field.type === "object") {
    if (field.fields) {
      type = "dict[str, Any]";
    } else {
      type = "dict[str, Any]";
    }
  } else {
    const primitiveMap: Record<string, string> = {
      string: "str",
      number: "int | float",
      boolean: "bool",
      null: "None",
    };
    type = primitiveMap[field.type] || "Any";
  }

  if (field.nullable || field.required === false) {
    type = `${type} | None`;
  }

  return type;
}

function getPythonDefaultValue(field: ContractField): string {
  if (field.required === false || field.nullable) {
    return " = None";
  }
  if (field.type === "array") {
    return " = field(default_factory=list)";
  }
  if (field.type === "object" && field.fields) {
    return " = field(default_factory=dict)";
  }
  return "";
}
