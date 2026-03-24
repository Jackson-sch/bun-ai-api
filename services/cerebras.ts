import Cerebras from "@cerebras/cerebras_cloud_sdk";
import type { AIService, ChatMessage } from "../types";

const cerebras = new Cerebras();

export const cerebrasService: AIService = {
  name: "cerebras",
  model: "llama3.1-8b",
  async chat(messages: ChatMessage[]) {
    const stream = await cerebras.chat.completions.create({
      "messages": messages as any,
      "model": "llama3.1-8b",
      "temperature": 0.6,
      "max_completion_tokens": 40960,
      "top_p": 0.95,
      "stream": true,
    });

    return (async function* () {
      for await (const chunk of stream) {
        yield (chunk as any).choices[0].delta.content || "";
      }
    })();
  }
};
