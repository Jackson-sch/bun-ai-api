import OpenAI from "openai";
import type { AIService, ChatMessage } from "../types";

const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY || "",
});

export const openrouterService: AIService = {
  name: "openrouter",
  async chat(messages: ChatMessage[]) {
    const stream = await openrouter.chat.completions.create({
      model: "meta-llama/llama-3.3-70b-instruct:free", // Free model
      messages: messages,
      temperature: 0.6,
      max_tokens: 4096,
      stream: true,
    });

    return (async function* () {
      for await (const chunk of stream) {
        yield chunk.choices[0]?.delta?.content || "";
      }
    })();
  },
};
