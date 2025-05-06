/**
 * Generates a default description template based on issue type
 */
export function generateDefaultDescription(
  issueType: string,
  summary: string
): any {
  let template: any = {
    type: "doc",
    version: 1,
    content: [],
  };

  // Add a heading
  template.content.push({
    type: "heading",
    attrs: { level: 2 },
    content: [{ type: "text", text: summary }],
  });

  // Add different sections based on issue type
  switch (issueType.toLowerCase()) {
    case "epic":
      template.content.push(
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Epic Overview" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "This epic covers..." }],
        },
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Goals" }],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Goal 1" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Goal 2" }],
                },
              ],
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Success Criteria" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "This epic will be considered successful when...",
            },
          ],
        }
      );
      break;

    case "story":
      template.content.push(
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "User Story" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "As a [type of user], I want [goal] so that [benefit].",
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Acceptance Criteria" }],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Criterion 1" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Criterion 2" }],
                },
              ],
            },
          ],
        }
      );
      break;

    case "bug":
      template.content.push(
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Description" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Describe the bug here..." }],
        },
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Steps to Reproduce" }],
        },
        {
          type: "orderedList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Step 1" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Step 2" }],
                },
              ],
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Expected Behavior" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "What should happen..." }],
        },
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Actual Behavior" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "What actually happens..." }],
        }
      );
      break;

    default: // Task or any other type
      template.content.push(
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Description" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Describe the task here..." }],
        },
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Acceptance Criteria" }],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Criterion 1" }],
                },
              ],
            },
          ],
        }
      );
      break;
  }

  return template;
}
