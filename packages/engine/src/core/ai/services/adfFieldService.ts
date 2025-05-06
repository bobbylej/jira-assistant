import { AICompletionTool, AIProvider, StructuredOutputConfig } from "../../../adapters/ai/types";
import { logger } from "../../../utils/logger";
import { JiraActionParams } from "../../jira";
import { SYSTEM_PROMPT } from "../constants/prompts/enhanceAdfField.prompts";
import { JiraContext } from "../types";
import { JiraParamsWithMetadata } from "../types";

export function configureADFFieldService(
  aiClient: AIProvider,
) {
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

The enhanced content must use Atlassian Document Format (ADF) structure:
1. Document Structure:
   - Root node must be "doc" with version: 1
   - Content must be an array of block nodes
   - Each block node must have a "type" and "content" properties

2. Block Nodes:
   - Paragraphs: { type: "paragraph", content: [...] }
   - Headings: { type: "heading", attrs: { level: 1-6 }, content: [...] }
   - Bullet Lists: { type: "bulletList", content: [...] }
   - Ordered Lists: { type: "orderedList", content: [...] }
   - Code Blocks: { type: "codeBlock", attrs: { language: "..." }, content: [...] }
   - Tables: { type: "table", content: [...] }
   - Panels: { type: "panel", attrs: { panelType: "info|note|warning|error" }, content: [...] }

3. Inline Nodes:
   - Text: { type: "text", text: "..." }
   - Links: { type: "text", text: "...", marks: [{ type: "link", attrs: { href: "..." } }] }
   - Mentions: { type: "mention", attrs: { id: "...", text: "..." } }
   - Emojis: { type: "emoji", attrs: { shortName: "..." } }

4. Text Marks (styling):
   - Bold: { type: "strong" }
   - Italic: { type: "em" }
   - Strikethrough: { type: "strike" }
   - Code: { type: "code" }
   - Underline: { type: "underline" }
   - Text Color: { type: "textColor", attrs: { color: "..." } }
   - Background Color: { type: "backgroundColor", attrs: { color: "..." } }

5. List Items:
   - Must be wrapped in listItem node: { type: "listItem", content: [...] }

6. Table Structure:
   - Table: { type: "table", content: [...] }
   - Table Row: { type: "tableRow", content: [...] }
   - Table Cell: { type: "tableCell", content: [...] }
   - Table Header: { type: "tableHeader", content: [...] }

Example structure:
{
  "version": 1,
  "type": "doc",
  "content": [
    {
      "type": "heading",
      "attrs": { "level": 1 },
      "content": [{ "type": "text", "text": "Main Title" }]
    },
    {
      "type": "paragraph",
      "content": [
        { "type": "text", "text": "This is " },
        { "type": "text", "text": "bold", "marks": [{ "type": "strong" }] },
        { "type": "text", "text": " text" }
      ]
    }
  ]
}

Below is the list of fields to enhance. Provide value for each field in ADF-compatible format.
<fields_to_enhance>
${adfFields
  .map(
    ([_key, param], index) => `\n${index + 1}. ${param.fieldName}:
"""
${param.value}
"""`
  )
  .join("\n")}
</fields_to_enhance>
`;

      // Add templates if available
      const fieldsWithTemplates = adfFields.filter(
        ([_, param]) => param.template
      );
      if (fieldsWithTemplates.length > 0) {
        prompt += `\nBelow are templates to follow for each field. Use them to structure the content.
<templates_to_follow>
${fieldsWithTemplates
  .map(
    ([_key, param], index) => `\n${index + 1}. ${param.fieldName} template:
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
</templates_to_follow>

Please restructure the content to match these templates exactly, maintaining all sections and ADF-compatible formatting. Ensure the content is:
1. Clear and concise
2. Technically accurate
3. Well-structured with proper headings and sections
4. Includes all necessary technical details`;
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

      prompt += `\n\nAlways use defined function "set_adf_fields" to return the enhanced content.`;

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
                    type: "object",
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
      logger.debug("Prompt:", prompt);

      const response = await aiClient.createChatCompletion({
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT
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
