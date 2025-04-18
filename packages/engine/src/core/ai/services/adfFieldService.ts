import {
  AICompletionTool,
  AIProvider,
} from "../../../adapters/ai/types";
import { logger } from "../../../utils/logger";
import { JiraActionParams } from "../../jira";
import { JiraContext } from "../types";
import { JiraParamsWithMetadata } from "../types";

export function configureADFFieldService(aiClient: AIProvider) {
  async function generateADFContent<T extends "createIssue" | "updateIssue">({
    issueType,
    params,
    context,
    chatHistory,
  }: {
    issueType: string;
    params: JiraParamsWithMetadata<keyof JiraActionParams<T>[0]>;
    context?: JiraContext;
    chatHistory?: any[];
  }): Promise<JiraParamsWithMetadata<keyof JiraActionParams<T>[0]>> {
    try {
      // Filter only ADF fields that need content generation
      const adfFields = Object.entries(params).filter(
        ([_, param]) => param.isADFField
      );

      if (adfFields.length === 0) {
        return params;
      }

      let prompt = `Generate content for multiple fields of a Jira ${issueType}.

Available context and values:
${Object.entries(params)
  .map(([_key, param]) => `- ${param.fieldName}: ${param.value || "(empty)"}`)
  .join("\n")}

The content should follow Atlassian Document Format (ADF) compatible formatting:
1. Use Markdown-style formatting which will be converted to ADF
2. Headers should use # syntax (e.g., # H1, ## H2)
3. Lists can be bulleted (-) or numbered (1.)
4. Code blocks should use triple backticks
5. Tables should use standard markdown table syntax
6. Text styling can include **bold**, *italic*, and ~~strikethrough~~
7. Links should use [text](url) format

Fields to generate content for:
${adfFields
  .map(
    ([_key, param]) =>
      `- ${param.fieldName}${param.template ? " (with template)" : ""}`
  )
  .join("\n")}

`;

      // Add templates if available
      const fieldsWithTemplates = adfFields.filter(
        ([_, param]) => param.template
      );
      if (fieldsWithTemplates.length > 0) {
        prompt += `\nTemplates to follow:
${fieldsWithTemplates
  .map(
    ([_key, param]) => `\n${param.fieldName} template:
"""
${param.template}
"""`
  )
  .join("\n")}

Please use these templates exactly as provided, maintaining all sections and ADF-compatible formatting.`;
      }

      // Add context information if available
      if (context) {
        prompt += `\n\nCurrent context: ${JSON.stringify(context)}`;
      }

      // Add chat history if available
      if (chatHistory && chatHistory.length > 0) {
        prompt += `\n\nRecent conversation:`;
        const recentMessages = chatHistory.slice(-5);
        recentMessages.forEach((msg) => {
          prompt += `\n- ${msg.role}: ${msg.content}`;
        });
      }

      // Add specific guidance based on issue type
      switch (issueType.toLowerCase()) {
        case "epic":
          prompt += `\n\nFor an Epic, ensure these sections are included where appropriate:
- Overview
- Goals
- Success Criteria
- Dependencies
- Stakeholders`;
          break;

        case "story":
          prompt += `\n\nFor a User Story, ensure these sections are included where appropriate:
- User Story Statement
- Acceptance Criteria
- Technical Notes
- Dependencies`;
          break;

        case "bug":
          prompt += `\n\nFor a Bug, ensure these sections are included where appropriate:
- Bug Description
- Steps to Reproduce
- Expected vs Actual Behavior
- Environment
- Impact`;
          break;

        default:
          prompt += `\n\nFor a Task, ensure these sections are included where appropriate:
- Overview
- Requirements
- Acceptance Criteria
- Notes`;
          break;
      }

      logger.debug("[INFO] Generated prompt:", prompt);

      const tools: AICompletionTool[] = [
        {
          type: "function",
          function: {
            name: "set_adf_fields",
            description: "Set values for ADF fields",
            parameters: {
              type: "object",
              properties: Object.fromEntries(
                adfFields.map(([_, param]) => [
                  param.fieldName,
                  {
                    type: "string",
                    description: `Content for ${param.fieldName} field in ADF-compatible markdown format`,
                  },
                ])
              ),
              required: adfFields.map(([_, param]) => param.fieldName),
            },
          },
        },
      ];

      logger.debug("Tools:", JSON.stringify(tools));

      const response = await aiClient.createChatCompletion({
        messages: [
          {
            role: "system",
            content:
              "You are a Jira expert who creates content in Atlassian Document Format (ADF) compatible markdown. You structure content with clear headings, lists, and proper formatting that can be converted to ADF. Your content is concise yet thorough, using appropriate formatting elements like tables, code blocks, and text styling where needed. You can generate multiple related fields at once, ensuring they work well together and are consistent with all available context.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.5,
        tools,
      });

      // Process the response
      const message = response.choices[0].message;

      const updatedParams = { ...params };

      // Handle tool calls
      logger.info("Tool calls:", JSON.stringify(message.tool_calls));
      message.tool_calls?.forEach((toolCall) => {
        const functionName = toolCall.function.name;
        const args = toolCall.function.arguments;

        switch (functionName) {
          case "set_adf_fields":
            Object.entries(args).forEach(([key, value]) => {
              updatedParams[key as keyof JiraActionParams<T>[0]] = {
                ...updatedParams[key as keyof JiraActionParams<T>[0]],
                value: value,
              };
            });
        }
      });

      return updatedParams;
    } catch (error) {
      logger.error("Error generating ADF content:", error);
      return params;
    }
  }

  async function enhanceADFContent<T extends "createIssue" | "updateIssue">({
    issueType,
    params,
    context,
    chatHistory,
  }: {
    issueType: string;
    params: JiraParamsWithMetadata<keyof JiraActionParams<T>[0]>;
    context?: JiraContext;
    chatHistory?: any[];
  }): Promise<JiraParamsWithMetadata<keyof JiraActionParams<T>[0]>> {
    // Filter only ADF fields that have content to enhance
    const adfFields = Object.entries(params).filter(
      ([_, param]) =>
        param.isADFField && param.value && param.value.trim() !== ""
    );

    if (adfFields.length === 0) {
      return params;
    }

    try {
      let prompt = `Enhance the following fields for a Jira ${issueType}.

Available context and values:
${Object.entries(params)
  .map(([_key, param]) => `- ${param.fieldName}: ${param.value || "(empty)"}`)
  .join("\n")}

The enhanced content must use Atlassian Document Format (ADF) compatible formatting:
1. Use Markdown-style formatting which will be converted to ADF
2. Headers should use # syntax (e.g., # H1, ## H2)
3. Lists can be bulleted (-) or numbered (1.)
4. Code blocks should use triple backticks
5. Tables should use standard markdown table syntax
6. Text styling can include **bold**, *italic*, and ~~strikethrough~~
7. Links should use [text](url) format

Fields to enhance:
${adfFields
  .map(
    ([_key, param]) => `\n${param.fieldName}:
"""
${param.value}
"""`
  )
  .join("\n")}

`;

      // Add templates if available
      const fieldsWithTemplates = adfFields.filter(
        ([_, param]) => param.template
      );
      if (fieldsWithTemplates.length > 0) {
        prompt += `\nTemplates to follow:
${fieldsWithTemplates
  .map(
    ([_key, param]) => `\n${param.fieldName} template:
"""
${param.template}
"""`
  )
  .join("\n")}

Please restructure the content to match these templates exactly, maintaining all sections and ADF-compatible formatting.`;
      }

      // Add context information if available
      if (context) {
        prompt += `\n\nCurrent context: ${JSON.stringify(context)}`;
      }

      // Add chat history if available
      if (chatHistory && chatHistory.length > 0) {
        prompt += `\n\nRecent conversation:`;
        const recentMessages = chatHistory.slice(-5);
        recentMessages.forEach((msg) => {
          prompt += `\n- ${msg.role}: ${msg.content}`;
        });
      }

      logger.debug("[INFO] Generated enhancement prompt:", prompt);

      const tools: AICompletionTool[] = [
        {
          type: "function",
          function: {
            name: "set_adf_fields",
            description: "Set values for ADF fields",
            parameters: {
              type: "object",
              properties: Object.fromEntries(
                adfFields.map(([_, param]) => [
                  param.key,
                  {
                    type: "string",
                    description: `Content for ${param.fieldName} field in ADF-compatible markdown format`,
                  },
                ])
              ),
              required: adfFields.map(([_, param]) => param.key.toString()),
            },
          },
        },
      ];

      logger.debug("Tools:", JSON.stringify(tools));

      const response = await aiClient.createChatCompletion({
        messages: [
          {
            role: "system",
            content:
              "You are a Jira expert who enhances content to be Atlassian Document Format (ADF) compatible. You improve content structure and formatting while preserving the original meaning, ensuring all formatting elements are ADF-compatible. You can enhance multiple related fields at once, maintaining consistency between them and with all available context. You improve the content to be more accurate and complete and fulfill good practices.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.5,
        tools,
      });

      logger.debug("Response:", JSON.stringify(response));

      // Process the response
      const message = response.choices[0].message;

      const updatedParams = { ...params };

      // Handle tool calls
      logger.info("Tool calls:", JSON.stringify(message.tool_calls));
      message.tool_calls?.forEach((toolCall) => {
        const functionName = toolCall.function.name;
        const args = toolCall.function.arguments;

        switch (functionName) {
          case "set_adf_fields":
            Object.entries(args).forEach(([key, value]) => {
              updatedParams[key as keyof JiraActionParams<T>[0]] = {
                ...updatedParams[key as keyof JiraActionParams<T>[0]],
                value: value,
              };
            });
        }
      });

      logger.debug("Updated params:", JSON.stringify(updatedParams));

      return updatedParams;
    } catch (error) {
      logger.error("Error enhancing ADF content:", error);
      return params;
    }
  }

  return {
    enhanceADFContent,
  };
}

export type ADFFieldService = ReturnType<typeof configureADFFieldService>;
