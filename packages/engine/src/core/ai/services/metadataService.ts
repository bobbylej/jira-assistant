import { logger } from "../../../utils/logger";
import { JiraActionParams, JiraService } from "../../jira";
import { IssueTypeMetadata, ProjectMetadata } from "../../jira";
import {
  JiraParamWithMetadata,
  JiraContext,
  JiraParamsWithMetadata,
  ToolFunctionProperty,
} from "../types";
import {
  generateToolDescription,
  generateToolEnumDescription,
  generateToolEnumValues,
  generateToolType,
  generateToolTypeDescription,
} from "../utils/metadata.utils";
import { AICompletionTool } from "../../../adapters/ai/types";

export function configureMetadataService(jiraService: JiraService) {
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
    tools: AICompletionTool[],
    metadata: ProjectMetadata
  ): AICompletionTool[] {
    // If we have no issue types metadata, return the original tools
    if (!metadata.issueTypes || metadata.issueTypes.length === 0) {
      return tools;
    }

    // Create a deep copy of the tools array to avoid modifying the original
    const updatedTools = JSON.parse(
      JSON.stringify(tools)
    ) as AICompletionTool[];

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

    return updatedTools;
  }

  // Function to create an issue type specific tool
  function createIssueTypeSpecificTool(
    originalTool: AICompletionTool,
    issueType: IssueTypeMetadata,
    action: "create" | "update",
    projectKey: string
  ): AICompletionTool {
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
        const fieldType = generateToolType(field.schema?.type);

        const isFieldArray = fieldType === "array";

        // Handle different array item types
        const hasItems = isFieldArray && field.schema?.items;
        const itemsType = hasItems
          ? generateToolType(field.schema?.items)
          : null;

        const itemsTypeDescription = hasItems
          ? generateToolTypeDescription(field.schema?.items)
          : null;

        const enumValues = generateToolEnumValues(field.allowedValues);

        const itemsEnumValuesDescription = isFieldArray
          ? generateToolEnumDescription(field.allowedValues)
          : null;

        // Create the field property
        const fieldProperty: ToolFunctionProperty = {
          type: fieldType,
          description: generateToolDescription(field, fieldType, itemsType),
          default: field.defaultValue,
          ...(!isFieldArray && enumValues?.length ? { enum: enumValues } : {}),
          ...(itemsType
            ? {
                items: {
                  type: itemsType,
                  description: `Items of type ${itemsType}${
                    itemsTypeDescription ? ` - ${itemsTypeDescription}` : ""
                  }${
                    itemsEnumValuesDescription
                      ? ` - ${itemsEnumValuesDescription}`
                      : ""
                  }`,
                  ...(isFieldArray && enumValues?.length
                    ? { enum: enumValues }
                    : {}),
                },
              }
            : {}),
        };

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

  async function getMetadataParams<T extends "createIssue" | "updateIssue">(
    actionParams: JiraActionParams<T>[0],
    context?: JiraContext
  ): Promise<Partial<
    JiraParamsWithMetadata<keyof JiraActionParams<T>[0]>
  > | null> {
    if (!context?.projectKey || !("issueType" in actionParams)) {
      logger.info("No context or issue type found");
      return null;
    }

    const projectMetadata = await fetchJiraMetadata(context.projectKey);
    if (!projectMetadata) {
      logger.info("No project metadata found");
      return null;
    }

    const issueType = projectMetadata.issueTypes.find(
      (type) => type.name === actionParams.issueType
    );

    if (!issueType) {
      logger.info("No issue type found", actionParams.issueType, JSON.stringify(projectMetadata));
      return null;
    }

    const metadataParams: Record<
      string,
      JiraParamWithMetadata<keyof JiraActionParams<T>[0]>
    > = {};
    Object.entries(actionParams).map(([key, value]) => {
      const field = issueType.fields.find((field) => field.key === key);
      // TODO: Set fieldName and for each param and return all params
      if (!field) {
        metadataParams[key] = {
          key: key as keyof JiraActionParams<T>[0],
          fieldName: key,
          value,
        };
        return;
      }

      // Description and fields with defaultValue as doc are ADF fields
      const isADFField = field.key === "description" ||
        (field.defaultValue &&
          typeof field.defaultValue === "object" &&
          "type" in field.defaultValue &&
          field.defaultValue.type === "doc");
          
      metadataParams[key] = {
        key: key as keyof JiraActionParams<T>[0],
        fieldName: field.name,
        value,
        isADFField: !!isADFField,
        template: isADFField ? JSON.stringify(field.defaultValue) : undefined,
      };
    });

    return metadataParams as Partial<
      JiraParamsWithMetadata<keyof JiraActionParams<T>[0]>
    >;
  }

  return {
    fetchJiraMetadata,
    updateToolsWithMetadata,
    generateMetadataSummary,
    getMetadataParams,
  };
}

export type MetadataService = ReturnType<typeof configureMetadataService>;
