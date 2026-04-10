// Type mappings from contract types to target language types

export interface TypeMapping {
  ts: string;
  py: string;
}

export const primitiveMappings: Record<string, TypeMapping> = {
  string: { ts: "string", py: "str" },
  number: { ts: "number", py: "int | float" },
  boolean: { ts: "boolean", py: "bool" },
  null: { ts: "null", py: "None" },
};

export function mapContractTypeToTs(
  type: string,
  items?: ContractType,
  enumValues?: string[]
): string {
  if (enumValues && enumValues.length > 0) {
    return enumValues.map((v) => `"${v}"`).join(" | ");
  }

  if (type === "array" && items) {
    const elementType = mapContractTypeToTs(
      items.type,
      items.items,
      items.enum
    );
    return `${elementType}[]`;
  }

  if (type === "object") {
    return "Record<string, unknown>";
  }

  return primitiveMappings[type]?.ts || "unknown";
}

export function mapContractTypeToPy(
  type: string,
  items?: ContractType,
  enumValues?: string[]
): string {
  if (enumValues && enumValues.length > 0) {
    return `Literal[${enumValues.map((v) => `"${v}"`).join(", ")}]`;
  }

  if (type === "array" && items) {
    const elementType = mapContractTypeToPy(
      items.type,
      items.items,
      items.enum
    );
    return `list[${elementType}]`;
  }

  if (type === "object") {
    return "dict[str, Any]";
  }

  return primitiveMappings[type]?.py || "Any";
}

export interface ContractType {
  type: string;
  items?: ContractType;
  enum?: string[];
}

export interface ContractField {
  type: string;
  items?: ContractType;
  enum?: string[];
  required?: boolean;
  nullable?: boolean;
  fields?: Record<string, ContractField>;
}
