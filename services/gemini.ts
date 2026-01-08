import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AIService, ChatMessage } from "../types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export const geminiService: AIService = {
  name: "gemini",
  async chat(messages: ChatMessage[]) {
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    // Find system message if exists
    const systemMessage = messages.find((msg) => msg.role === "system");
    
    // Filter out system messages and convert to Gemini format
    const chatMessages = messages.filter((msg) => msg.role !== "system");
    const history = chatMessages.slice(0, -1).map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    const lastMessage = chatMessages[chatMessages.length - 1];
    
    if (!lastMessage) {
      return (async function* () {
        yield "";
      })();
    }
    
    const chat = model.startChat({
      history,
      ...(systemMessage && { systemInstruction: systemMessage.content }),
    });

    const result = await chat.sendMessageStream(lastMessage.content);

    return (async function* () {
      for await (const chunk of result.stream) {
        yield chunk.text();
      }
    })();
  },
};
