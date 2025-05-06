/**
 * Formats a description into Jira's Atlassian Document Format (ADF)
 */
export function formatDescription(description: string): any {
  // If the description is already in ADF format, return it as is
  if (typeof description === "object") {
    return description;
  }

  // Convert Markdown to ADF
  return convertMarkdownToADF(description);
}

/**
 * Converts Markdown formatted text to Atlassian Document Format (ADF)
 */
function convertMarkdownToADF(markdown: string): any {
  if (!markdown) {
    return {
      type: "doc",
      version: 1,
      content: [],
    };
  }

  // Split the markdown into lines for processing
  const lines = markdown.split("\n");
  const adfContent: any[] = [];

  let currentListItems: any[] = [];
  let currentListType: string | null = null;
  let codeBlockContent = "";
  let inCodeBlock = false;

  // Process each line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Handle code blocks
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        // End of code block
        adfContent.push({
          type: "codeBlock",
          attrs: { language: "text" },
          content: [{ type: "text", text: codeBlockContent }],
        });
        codeBlockContent = "";
        inCodeBlock = false;
      } else {
        // Start of code block
        inCodeBlock = true;
        // Extract language if specified
        const language = line.trim().substring(3).trim() || "text";
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent += line + "\n";
      continue;
    }

    // Skip empty lines but finish any current list
    if (!line.trim()) {
      if (currentListItems.length > 0) {
        adfContent.push({
          type: currentListType === "ul" ? "bulletList" : "orderedList",
          content: currentListItems,
        });
        currentListItems = [];
        currentListType = null;
      }
      continue;
    }

    // Check for headings (# Heading)
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      // Finish any current list
      if (currentListItems.length > 0) {
        adfContent.push({
          type: currentListType === "ul" ? "bulletList" : "orderedList",
          content: currentListItems,
        });
        currentListItems = [];
        currentListType = null;
      }

      adfContent.push({
        type: "heading",
        attrs: { level: headingMatch[1].length },
        content: parseInlineMarkdown(headingMatch[2]),
      });
      continue;
    }

    // Check for bullet list items (- item or * item)
    const bulletMatch = line.match(/^(\s*)([-*])\s+(.+)$/);
    if (bulletMatch) {
      // If we're switching from a different list type, finish the previous list
      if (currentListType && currentListType !== "ul") {
        adfContent.push({
          type: "orderedList",
          content: currentListItems,
        });
        currentListItems = [];
      }

      currentListType = "ul";
      currentListItems.push({
        type: "listItem",
        content: [
          {
            type: "paragraph",
            content: parseInlineMarkdown(bulletMatch[3]),
          },
        ],
      });
      continue;
    }

    // Check for numbered list items (1. item)
    const numberedMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      // If we're switching from a different list type, finish the previous list
      if (currentListType && currentListType !== "ol") {
        adfContent.push({
          type: "bulletList",
          content: currentListItems,
        });
        currentListItems = [];
      }

      currentListType = "ol";
      currentListItems.push({
        type: "listItem",
        content: [
          {
            type: "paragraph",
            content: parseInlineMarkdown(numberedMatch[3]),
          },
        ],
      });
      continue;
    }

    // If we were building a list and encounter a non-list line, finish the list
    if (currentListItems.length > 0) {
      adfContent.push({
        type: currentListType === "ul" ? "bulletList" : "orderedList",
        content: currentListItems,
      });
      currentListItems = [];
      currentListType = null;
    }

    // Regular paragraph
    adfContent.push({
      type: "paragraph",
      content: parseInlineMarkdown(line),
    });
  }

  // If we have any remaining list items, add the list
  if (currentListItems.length > 0) {
    adfContent.push({
      type: currentListType === "ul" ? "bulletList" : "orderedList",
      content: currentListItems,
    });
  }

  return {
    type: "doc",
    version: 1,
    content: adfContent,
  };
}

/**
 * Parses inline Markdown formatting (bold, italic, code, links) within text
 */
function parseInlineMarkdown(text: string): any[] {
  const content: any[] = [];
  let currentText = "";
  let i = 0;

  while (i < text.length) {
    // Bold (**text**)
    if (text.substring(i, i + 2) === "**" && i + 2 < text.length) {
      // Push any accumulated text
      if (currentText) {
        content.push({ type: "text", text: currentText });
        currentText = "";
      }

      // Find the closing **
      const start = i + 2;
      let end = text.indexOf("**", start);
      if (end === -1) end = text.length;

      // Add the bold text
      content.push({
        type: "text",
        text: text.substring(start, end),
        marks: [{ type: "strong" }],
      });

      i = end + 2;
      continue;
    }

    // Italic (*text* or _text_)
    if (
      (text[i] === "*" || text[i] === "_") &&
      text[i + 1] !== text[i] && // Not part of ** or __
      i + 1 < text.length
    ) {
      // Push any accumulated text
      if (currentText) {
        content.push({ type: "text", text: currentText });
        currentText = "";
      }

      const marker = text[i];
      const start = i + 1;
      let end = text.indexOf(marker, start);
      if (end === -1) end = text.length;

      // Add the italic text
      content.push({
        type: "text",
        text: text.substring(start, end),
        marks: [{ type: "em" }],
      });

      i = end + 1;
      continue;
    }

    // Inline code (`code`)
    if (text[i] === "`") {
      // Push any accumulated text
      if (currentText) {
        content.push({ type: "text", text: currentText });
        currentText = "";
      }

      const start = i + 1;
      let end = text.indexOf("`", start);
      if (end === -1) end = text.length;

      // Add the code text
      content.push({
        type: "text",
        text: text.substring(start, end),
        marks: [{ type: "code" }],
      });

      i = end + 1;
      continue;
    }

    // Links [text](url)
    if (text[i] === "[") {
      // Push any accumulated text
      if (currentText) {
        content.push({ type: "text", text: currentText });
        currentText = "";
      }

      const textStart = i + 1;
      let textEnd = text.indexOf("]", textStart);
      if (textEnd === -1) {
        currentText += text[i];
        i++;
        continue;
      }

      if (text.substring(textEnd + 1, textEnd + 2) === "(") {
        const urlStart = textEnd + 2;
        let urlEnd = text.indexOf(")", urlStart);
        if (urlEnd === -1) {
          currentText += text[i];
          i++;
          continue;
        }

        // Add the link
        content.push({
          type: "text",
          text: text.substring(textStart, textEnd),
          marks: [
            {
              type: "link",
              attrs: {
                href: text.substring(urlStart, urlEnd),
              },
            },
          ],
        });

        i = urlEnd + 1;
        continue;
      } else {
        currentText += text[i];
        i++;
        continue;
      }
    }

    // Regular text
    currentText += text[i];
    i++;
  }

  // Add any remaining text
  if (currentText) {
    content.push({ type: "text", text: currentText });
  }

  return content;
}
