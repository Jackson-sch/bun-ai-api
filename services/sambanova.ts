import OpenAI from "openai";
import type { AIService, ChatMessage } from "../types";

const sambanova = new OpenAI({
  baseURL: "https://api.sambanova.ai/v1",
  apiKey: process.env.SAMBANOVA_API_KEY || "",
});

export const sambanovaService: AIService = {
  name: "sambanova",
  async chat(messages: ChatMessage[]) {
    const stream = await sambanova.chat.completions.create({
      model: "Meta-Llama-3.3-70B-Instruct",
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
