import {
  GoogleGenAI,
  Content,
  createUserContent,
  createPartFromUri,
  Schema,
  Type,
  FunctionDeclaration,
} from "@google/genai";
import {
  AIModelConfig,
  AIProvider,
  AICompletionParams,
  AICompletionResponse,
  AITranscriptionResponse,
  StructuredOutputConfig,
} from "./types";
import { ToolFunctionProperty } from "../../core/ai";

export function configureGeminiAdapter(config: AIModelConfig): AIProvider {
  const client = new GoogleGenAI({ apiKey: config.apiKey });
  const defaultModel: string = "gemini-2.0-flash";

  function convertToolPropertyTypeToGeminiType(
    type: ToolFunctionProperty["type"]
  ): Type {
    return (
      {
        object: Type.OBJECT,
        string: Type.STRING,
        number: Type.NUMBER,
        boolean: Type.BOOLEAN,
        array: Type.ARRAY,
        doc: Type.OBJECT,
      }[type] || Type.STRING
    );
  }

  function convertToolPropertyToGeminiFormat(
    property: ToolFunctionProperty
  ): Schema {
    return {
      title: property.name,
      type: convertToolPropertyTypeToGeminiType(property.type),
      description: property.description,
      items: property.items
        ? convertToolPropertyToGeminiFormat(property.items)
        : undefined,
      enum: property.enum,
    };
  }

  function convertToolPropertiesToGeminiFormat(
    properties: Record<string, ToolFunctionProperty>
  ): Record<string, Schema> {
    return Object.fromEntries(
      Object.entries(properties).map(([key, property]) => [
        key,
        convertToolPropertyToGeminiFormat(property),
      ])
    );
  }

  function convertMessagesToGeminiFormat(
    messages: AICompletionParams["messages"]
  ): Content[] {
    // Filter out system messages as Gemini doesn't have system role
    // and convert to Gemini's format
    return messages
      .filter((msg) => msg.role !== "system")
      .map((msg) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      }));
  }

  function convertToolsToGeminiFormat(
    tools: AICompletionParams["tools"]
  ): FunctionDeclaration[] {
    return (
      tools?.map((tool) => ({
        name: tool.function.name,
        description: tool.function.description,
        parameters: {
          type: Type.OBJECT,
          properties: convertToolPropertiesToGeminiFormat(
            tool.function.parameters?.properties as Record<
              string,
              ToolFunctionProperty
            >
          ),
          required: tool.function.parameters?.required as string[] || [],
        },
      })) || []
    );
  }

  function convertStructuredOutputToGeminiConfig(
    config: StructuredOutputConfig
  ): { responseMimeType: string; responseSchema: Schema } | undefined {
    if (!config) return undefined;

    if (config.type === 'enum' && config.enum) {
      return {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.STRING,
          enum: config.enum,
        },
      };
    }

    if (config.type === 'json' && config.schema) {
      const schema: Schema = {
        type: config.schema.type === 'object' ? Type.OBJECT : Type.ARRAY,
      };

      if (config.schema.properties) {
        schema.properties = Object.fromEntries(
          Object.entries(config.schema.properties).map(([key, prop]) => [
            key,
            {
              type: convertToolPropertyTypeToGeminiType(prop.type as any),
              description: prop.description,
              enum: prop.enum,
              format: prop.format,
              items: prop.items ? {
                type: convertToolPropertyTypeToGeminiType(prop.items.type as any),
                description: prop.items.description,
              } : undefined,
            },
          ])
        );
      }

      if (config.schema.required) {
        schema.required = config.schema.required;
      }

      if (config.schema.items) {
        schema.items = {
          type: convertToolPropertyTypeToGeminiType(config.schema.items.type as any),
          description: config.schema.items.description,
        };
      }

      return {
        responseMimeType: 'application/json',
        responseSchema: schema,
      };
    }

    return undefined;
  }

  async function createChatCompletion(
    params: AICompletionParams
  ): Promise<AICompletionResponse> {
    try {
      // Convert OpenAI format messages to Gemini format
      const contents = convertMessagesToGeminiFormat(params.messages);
      const tools = convertToolsToGeminiFormat(params.tools);
      const structuredOutput = params.structuredOutput ? convertStructuredOutputToGeminiConfig(params.structuredOutput) : undefined;

      // Handle system message specially since Gemini doesn't have a system role
      const systemMessage = params.messages.find(
        (msg) => msg.role === "system"
      );
      const systemInstruction = systemMessage ? systemMessage.content : "";

      // Create chat session
      const response = await client.models.generateContent({
        model: params.model || defaultModel,
        contents,
        config: {
          tools: [
            {
              functionDeclarations: tools,
            },
          ],
          temperature: params.temperature || 0.7,
          ...structuredOutput,
        },
      });

      // Convert Gemini response to OpenAI format
      const toolCalls = response.functionCalls?.map((functionCall) => {
        return {
          function: {
            name: functionCall.name,
            arguments: functionCall.args,
          },
        };
      });

      return {
        choices: [
          {
            message: {
              role: "assistant",
              content: response.text || null,
              tool_calls: toolCalls,
            },
            index: 0,
          },
        ],
      };
    } catch (error) {
      console.error("Error in Gemini adapter:", error);
      throw error;
    }
  }

  async function transcribeAudio(audioFile: {
    path: string;
    type: string;
  }): Promise<AITranscriptionResponse> {
    const myfile = await client.files.upload({
      file: audioFile.path,
      config: {
        mimeType: audioFile.type,
      },
    });

    if (!myfile.uri || !myfile.mimeType) {
      throw new Error("Failed to upload audio file");
    }

    const response = await client.models.generateContent({
      model: "gemini-2.0-flash",
      contents: createUserContent([
        createPartFromUri(myfile.uri, myfile.mimeType),
        "Generate a transcript of the speech.",
      ]),
    });

    return {
      text: response.text || "",
    };
  }

  return {
    createChatCompletion,
    transcribeAudio,
  };
}
