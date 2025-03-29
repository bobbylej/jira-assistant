import { ChatCompletionTool } from "openai/resources";
import { logger } from "../../../utils/logger";
import { JiraService } from "../../jira";
import {
  IssueTypeMetadata,
  ProjectMetadata,
} from "../../jira";
import { ToolFunctionProperty } from "../types";
import { generateDocFieldDescription } from "../utils/prompts.utils";

export interface MetadataService {
  fetchJiraMetadata: (projectIdOrKey?: string) => Promise<ProjectMetadata | null>;
  updateToolsWithMetadata: (tools: ChatCompletionTool[], metadata: ProjectMetadata) => ChatCompletionTool[];
  generateMetadataSummary: (metadata: ProjectMetadata) => string;
}

export function configureMetadataService(jiraService: JiraService): MetadataService {
  // Function to fetch metadata for available fields
  async function fetchJiraMetadata(
    projectIdOrKey?: string
  ): Promise<ProjectMetadata | null> {
    try {
      if (!projectIdOrKey) {
        logger.info("No project key provided for metadata fetch");
        return null;
      }

      // First get all issue types for the project
      const issueTypesMetadata = await jiraService.getCreateMetadataIssueTypes(
        projectIdOrKey
      );
      logger.info(
        `Fetched ${
          issueTypesMetadata?.issueTypes?.length || 0
        } issue types for project ${projectIdOrKey}`
      );

      // Create a comprehensive metadata object with fields for each issue type
      const fullMetadata: ProjectMetadata = {
        projectKey: projectIdOrKey,
        issueTypes: [],
      };

      if (!issueTypesMetadata?.issueTypes?.length) {
        return fullMetadata; // Return what we have if no issue types found
      }

      // For each issue type, get its field metadata
      for (const issueType of issueTypesMetadata.issueTypes) {
        try {
          const fieldMetadata = await jiraService.getCreateFieldMetadata(
            projectIdOrKey,
            issueType.id
          );

          fullMetadata.issueTypes.push({
            id: issueType.id,
            name: issueType.name,
            description: issueType.description,
            fields: fieldMetadata.fields,
            subtask: issueType.subtask,
          });

          logger.info(
            `Fetched field metadata for issue type ${issueType.name}`
          );
        } catch (error) {
          logger.warn(
            `Failed to fetch field metadata for issue type ${issueType.name}:`,
            error
          );
          // Still include the issue type but without detailed field info
          fullMetadata.issueTypes.push({
            id: issueType.id,
            name: issueType.name,
            description: issueType.description,
            fields: [],
            subtask: issueType.subtask,
          });
        }
      }

      return fullMetadata;
    } catch (error) {
      logger.error("Error fetching Jira metadata:", error);
      return null;
    }
  }

  // Function to update the tools with metadata
  function updateToolsWithMetadata(
    tools: ChatCompletionTool[],
    metadata: ProjectMetadata
  ): ChatCompletionTool[] {
    // Create a deep copy of the tools array to avoid modifying the original
    const updatedTools = JSON.parse(
      JSON.stringify(tools)
    ) as ChatCompletionTool[];

    // Find and remove the generic create_issue and update_issue tools
    const createIssueIndex = updatedTools.findIndex(
      (tool) =>
        tool.type === "function" && tool.function.name === "create_issue"
    );

    const updateIssueIndex = updatedTools.findIndex(
      (tool) =>
        tool.type === "function" && tool.function.name === "update_issue"
    );

    // Store the original tools before removing them
    const originalCreateIssueTool =
      createIssueIndex >= 0 ? updatedTools[createIssueIndex] : null;
    const originalUpdateIssueTool =
      updateIssueIndex >= 0 ? updatedTools[updateIssueIndex] : null;

    // Remove the original tools (if found)
    if (createIssueIndex >= 0) {
      updatedTools.splice(createIssueIndex, 1);
    }

    if (updateIssueIndex >= 0) {
      updatedTools.splice(
        updateIssueIndex > createIssueIndex
          ? updateIssueIndex - 1
          : updateIssueIndex,
        1
      );
    }

    // If we have issue types metadata, create specific tools for each type
    if (metadata.issueTypes && metadata.issueTypes.length > 0) {
      metadata.issueTypes.forEach((issueType) => {
        // Create a tool for creating this specific issue type
        if (originalCreateIssueTool) {
          const createTool = createIssueTypeSpecificTool(
            originalCreateIssueTool,
            issueType,
            "create",
            metadata.projectKey
          );
          updatedTools.push(createTool);
        }

        // Create a tool for updating to this specific issue type
        if (originalUpdateIssueTool) {
          const updateTool = createIssueTypeSpecificTool(
            originalUpdateIssueTool,
            issueType,
            "update",
            metadata.projectKey
          );
          updatedTools.push(updateTool);
        }
      });
    } else {
      // If no metadata, add back the original tools
      if (originalCreateIssueTool) {
        updatedTools.push(originalCreateIssueTool);
      }

      if (originalUpdateIssueTool) {
        updatedTools.push(originalUpdateIssueTool);
      }
    }

    return updatedTools;
  }

  // Function to create an issue type specific tool
  function createIssueTypeSpecificTool(
    originalTool: ChatCompletionTool,
    issueType: IssueTypeMetadata,
    action: "create" | "update",
    projectKey: string
  ): ChatCompletionTool {
    // Create a deep copy of the original tool
    const newTool = JSON.parse(JSON.stringify(originalTool));

    // Set the name and description based on the action and issue type
    const typeName = issueType.name.toLowerCase().replace(/\s+/g, "_");
    if (action === "create") {
      newTool.function.name = `create_${typeName}`;
      newTool.function.description = `Create a new ${issueType.name} in Jira${
        issueType.description ? ` (${issueType.description})` : ""
      }`;
    } else {
      newTool.function.name = `update_${typeName}`;
      newTool.function.description = `Update ${issueType.name} in Jira${
        issueType.description ? ` (${issueType.description})` : ""
      }`;
    }

    // Set project key as fixed value
    newTool.function.parameters.properties.projectKey = {
      type: "string",
      description: "The project key (e.g., PROJ)",
      default: projectKey,
    };

    // Set one choice for issueType
    newTool.function.parameters.properties.issueType = {
      type: "string",
      description: "The type of issue",
      enum: [issueType.name],
      default: issueType.name,
    };

    // Remove parent if this is not a subtask
    if (!issueType.subtask) {
      delete newTool.function.parameters.properties.parent;
    } else {
      // Make parent required for subtasks
      newTool.function.parameters.required.push("parent");
    }

    // Add custom fields based on the issue type's fields
    if (issueType.fields && issueType.fields.length > 0) {
      issueType.fields.forEach((field) => {
        // Skip standard fields that are already in the schema or will be auto-filled
        const fieldsToSkip = [
          "summary",
          "issuetype",
          "project",
          "parent",
          "reporter",
          "team",
        ];
        if (fieldsToSkip.includes(field.key)) {
          return;
        }

        // Determine the appropriate field type based on Jira's schema
        let fieldType = "string"; // Default type
        let itemsType = "string"; // Default items type for arrays
        let itemsTypeDescription = "";

        if (field.schema) {
          // Map Jira schema types to JSON Schema types
          switch (field.schema.type) {
            case "number":
            case "integer":
              fieldType = field.schema.type;
              break;
            case "array":
              fieldType = "array";
              // Handle different array item types
              if (field.schema.items) {
                // Keep track of the original Jira type for description
                itemsType = field.schema.items;

                // Special handling for issuelinks in arrays
                if (field.schema.items === "issuelinks") {
                  itemsType = "string";
                  itemsTypeDescription = "Use issue key (e.g., PROJ-123)";
                }
              }
              break;
            case "boolean":
              fieldType = "boolean";
              break;
            case "issuelinks":
              fieldType = "string";
              break;
            case "user":
            case "group":
            case "version":
            case "component":
            case "option":
            case "priority":
            case "resolution":
              // These are all string-based IDs in the API
              fieldType = "string";
              break;
            case "datetime":
            case "date":
              // Dates are passed as strings in ISO format
              fieldType = "string";
              break;
            default:
              // Default to string for any other types
              fieldType = "string";
          }
        }

        // Create the field property
        const fieldProperty: ToolFunctionProperty = {
          type: fieldType as any,
          description: `${field.name}${field.required ? " (Required)" : ""}${
            field.schema
              ? ` [${field.schema.type}${
                  field.schema.type === "array" ? ` of ${itemsType}` : ""
                }]`
              : ""
          }`,
          default: field.defaultValue,
        };

        // Add more specific information based on field type
        if (field.schema) {
          switch (field.schema.type) {
            case "user":
              fieldProperty.description += ` - Use account ID from get_project_users`;
              break;
            case "array":
              fieldProperty.items = {
                type: "string",
                description: `Items of type ${itemsType}${
                  itemsTypeDescription ? ` - ${itemsTypeDescription}` : ""
                }`,
              };
              break;
            case "datetime":
              fieldProperty.description += ` - Use ISO format (YYYY-MM-DDTHH:MM:SS.sssZ)`;
              break;
            case "date":
              fieldProperty.description += ` - Use ISO format (YYYY-MM-DD)`;
              break;
            case "issuelinks":
              fieldProperty.description += ` - Use issue key (e.g., PROJ-123)`;
              break;
            case "doc":
              fieldProperty.description += generateDocFieldDescription(field, action);
              break;
          }
        }

        const isDocField =
          field.defaultValue &&
          typeof field.defaultValue === "object" &&
          "type" in field.defaultValue &&
          field.defaultValue.type === "doc";
        if (isDocField) {
          fieldProperty.description += generateDocFieldDescription(field, action);
        }

        // If there's an autocomplete URL, mention it in the description
        if (field.autoCompleteUrl) {
          fieldProperty.description += ` - Values can be looked up via API at ${field.autoCompleteUrl}`;
        }

        // If there are allowed values, add them as enum
        if (field.allowedValues && field.allowedValues.length > 0) {
          const enumValues = field.allowedValues.map((v) => {
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

          // Get details about the allowed values if they are objects
          const allowedValuesDetails = field.allowedValues.map((v) => {
            if (typeof v === "object") {
              const value = v as any;
              return {
                ...(value.name ? { name: value.name} : {}),
                ...(value.value ? { value: value.value} : {}),
                ...(value.key ? { key: value.key} : {}),
                ...(value.id ? { id: value.id} : {}),
                ...(value.description ? { description: value.description} : {}),
              };
            }
          }).filter((v) => !!v);

          const allowedValuesDescription = allowedValuesDetails.length > 0 ? ` - Details about allowed values: ${allowedValuesDetails.map((v) => {
            if (typeof v === "object") {
              return `\n\`\`\`\n${JSON.stringify(v)}\n\`\`\`\n`;
            }
            return v;
          }).join("")}` : "";

          if (fieldType === "array") {
            if (fieldProperty.items) {
              fieldProperty.items.enum = enumValues;
              fieldProperty.items.description += allowedValuesDescription;
            }
          } else {
            fieldProperty.enum = enumValues;
            fieldProperty.description += allowedValuesDescription;
          }
        }

        // Add the field to the properties
        newTool.function.parameters.properties[field.key] = fieldProperty;

        // If the field is required, add it to the required array
        if (
          field.required &&
          !newTool.function.parameters.required.includes(field.key)
        ) {
          newTool.function.parameters.required.push(field.key);
        }
      });
    }

    return newTool;
  }

  // Function to generate a brief summary of available issue types
  function generateMetadataSummary(metadata: ProjectMetadata): string {
    let summary = "";

    if (metadata.issueTypes && metadata.issueTypes.length > 0) {
      summary = metadata.issueTypes
        .map((type) => {
          let typeSummary = `- ${type.name}`;
          if (type.description) {
            typeSummary += `: ${type.description}`;
          }
          return typeSummary;
        })
        .join("\n");
    }

    return summary;
  }

  return {
    fetchJiraMetadata,
    updateToolsWithMetadata,
    generateMetadataSummary,
  };
} 