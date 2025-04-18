import { FieldMetadata, FieldValueType } from "../../jira";
import { ToolFunctionPropertyType } from "../types";

export function generateToolType(
  jiraFieldType: string | undefined
): ToolFunctionPropertyType {
  // Map Jira schema types to JSON Schema types
  switch (jiraFieldType) {
    case "number":
    case "integer":
      return "number";
    case "array":
      return "array";
    case "boolean":
      return "boolean";
    case "issuelinks":
      return "string";
    case "user":
    case "group":
    case "version":
    case "component":
    case "option":
    case "priority":
    case "resolution":
      // These are all string-based IDs in the API
      return "string";
    case "datetime":
    case "date":
      // Dates are passed as strings in ISO format
      return "string";
    default:
      // Default to string for any other types
      return "string";
  }
}

export function generateToolTypeDescription(
  jiraFieldType: string | undefined
): string | undefined {
  switch (jiraFieldType) {
    case "user":
      return `Use account ID from get_project_users`;
    case "datetime":
      return `Use ISO format (YYYY-MM-DDTHH:MM:SS.sssZ)`;
    case "date":
      return `Use ISO format (YYYY-MM-DD)`;
    case "issuelinks":
      return `Use issue key (e.g., PROJ-123)`;
  }
}

export function generateToolEnumValues(
  fieldAllowedValues: FieldValueType[] | undefined
): string[] | null {
  if (fieldAllowedValues && fieldAllowedValues.length > 0) {
    const enumValues = fieldAllowedValues.map((v) => {
      // Handle different formats of allowed values
      if (Array.isArray(v)) {
        return v.join(", ");
      }
      if (typeof v === "object") {
        const value = v as any;
        return value.name || value.value || value.key || value.id;
      }
      return String(v);
    });
    return enumValues;
  }
  return null;
}

export function generateToolEnumDescription(
  fieldAllowedValues: FieldValueType[] | undefined
): string | null {
  if (fieldAllowedValues && fieldAllowedValues.length > 0) {
    const allowedValuesDetails = fieldAllowedValues
      .map((v) => {
        if (typeof v === "object") {
          const value = v as any;
          return {
            ...(value.name ? { name: value.name } : {}),
            ...(value.value ? { value: value.value } : {}),
            ...(value.key ? { key: value.key } : {}),
            ...(value.id ? { id: value.id } : {}),
            ...(value.description ? { description: value.description } : {}),
          };
        }
      })
      .filter((v) => !!v);

    const allowedValuesDescription =
      allowedValuesDetails.length > 0
        ? `Details about allowed values: ${allowedValuesDetails
            .map((v) => {
              return `\n\`\`\`\n${JSON.stringify(v)}\n\`\`\`\n`;
            })
            .join("")}`
        : "";

    return allowedValuesDescription;
  }
  return null;
}

export function generateToolDescription(
  field: FieldMetadata,
  fieldType: ToolFunctionPropertyType,
  itemsType: ToolFunctionPropertyType | null
): string {
  const fieldTypeDescription = generateToolTypeDescription(field.schema?.type);

  const requiredDescription = field.required ? " (Required)" : "";

  const fieldSchemaDescription = field.schema
    ? ` [${field.schema.type}${
        field.schema.type === "array" ? ` of ${itemsType}` : ""
      }] - ${fieldTypeDescription}`
    : "";

  // If there's an autocomplete URL, mention it in the description
  const autocompleteDescription = field.autoCompleteUrl
    ? ` - Values can be looked up via API at ${field.autoCompleteUrl}`
    : "";

  const enumValuesDescription =
    fieldType !== "array"
      ? generateToolEnumDescription(field.allowedValues)
      : "";

  return `${
    field.name
  }${requiredDescription}${fieldSchemaDescription}${autocompleteDescription}${
    enumValuesDescription ? ` - ${enumValuesDescription}` : ""
  }`;
}
