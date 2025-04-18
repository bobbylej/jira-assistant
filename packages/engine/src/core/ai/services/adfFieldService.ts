import { AICompletionTool, AIProvider } from "../../../adapters/ai/types";
import { logger } from "../../../utils/logger";
import { JiraActionParams } from "../../jira";
import { JiraContext } from "../types";
import { JiraParamsWithMetadata } from "../types";

export function configureADFFieldService(aiClient: AIProvider) {
  function getHintsToGenerateDescriptionBasedOnIssueType(issueType: string) {
    switch (issueType.toLowerCase()) {
      case "epic":
        return JSON.stringify({
          version: 1,
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Overview:",
                  marks: [{ type: "strong" }],
                },
              ],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Provide overview here.",
                },
              ],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Goals:",
                  marks: [{ type: "strong" }],
                },
              ],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Provide goals here.",
                },
              ],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Success Criteria:",
                  marks: [{ type: "strong" }],
                },
              ],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Provide success criteria here.",
                },
              ],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Dependencies:",
                  marks: [{ type: "strong" }],
                },
              ],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Provide dependencies here.",
                },
              ],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Stakeholders:",
                  marks: [{ type: "strong" }],
                },
              ],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Provide stakeholders here.",
                },
              ],
            },
          ],
        });

      case "story":
        return JSON.stringify({
          version: 1,
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "User Story Statement:",
                  marks: [{ type: "strong" }],
                },
              ],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Provide user story statement here.",
                },
              ],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Acceptance Criteria:",
                  marks: [{ type: "strong" }],
                },
              ],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Provide acceptance criteria here.",
                },
              ],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Technical Notes:",
                  marks: [{ type: "strong" }],
                },
              ],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Provide technical notes here.",
                },
              ],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Dependencies:",
                  marks: [{ type: "strong" }],
                },
              ],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Provide dependencies here.",
                },
              ],
            },
          ],
        });

      case "bug":
        return JSON.stringify({
          version: 1,
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Bug Description:",
                  marks: [{ type: "strong" }],
                },
              ],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Provide bug description here.",
                },
              ],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Steps to Reproduce:",
                  marks: [{ type: "strong" }],
                },
              ],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Provide steps to reproduce here.",
                },
              ],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Expected vs Actual Behavior:",
                  marks: [{ type: "strong" }],
                },
              ],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Provide expected vs actual behavior here.",
                },
              ],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Environment:",
                  marks: [{ type: "strong" }],
                },
              ],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Provide environment details here.",
                },
              ],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Impact:",
                  marks: [{ type: "strong" }],
                },
              ],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Provide impact details here.",
                },
              ],
            },
          ],
        });

      default:
        return JSON.stringify({
          version: 1,
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Overview:",
                  marks: [{ type: "strong" }],
                },
              ],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Provide overview here.",
                },
              ],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Requirements:",
                  marks: [{ type: "strong" }],
                },
              ],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Provide requirements here.",
                },
              ],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Acceptance Criteria:",
                  marks: [{ type: "strong" }],
                },
              ],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Provide acceptance criteria here.",
                },
              ],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Notes:",
                  marks: [{ type: "strong" }],
                },
              ],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Provide notes here.",
                },
              ],
            },
          ],
        });
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
${
  param.template
    ? param.template
    : param.key === "description"
    ? getHintsToGenerateDescriptionBasedOnIssueType(issueType)
    : ""
}
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
