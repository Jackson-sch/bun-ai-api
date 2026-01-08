import { groqService } from './services/groq';
import { cerebrasService } from './services/cerebras';
import { geminiService } from './services/gemini';
import { openrouterService } from './services/openrouter';
import { sambanovaService } from './services/sambanova';
import type { AIService, ChatMessage } from './types';

const services: AIService[] = [
  groqService,
  cerebrasService,
  geminiService,
  openrouterService,
  sambanovaService,
]
let currentServiceIndex = 0;

function getNextService() {
  const service = services[currentServiceIndex];
  currentServiceIndex = (currentServiceIndex + 1) % services.length;
  return service;
}

const server = Bun.serve({
  port: process.env.PORT ?? 3000,
  async fetch(req) {
    const url = new URL(req.url);
    const { pathname } = url;

    // CORS headers for all requests
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check endpoint
    if (req.method === 'GET' && pathname === '/') {
      return new Response(JSON.stringify({ 
        status: 'ok', 
        services: services.map(s => s.name),
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'POST' && pathname === '/chat') {
      const { messages } = await req.json() as { messages: ChatMessage[] };
      const service = getNextService();

      console.log(`Using ${service?.name} service`);
      
      if (!service) {
        return new Response(JSON.stringify({ error: 'No service available' }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const asyncIterator = await service.chat(messages);

      // Convert AsyncGenerator to ReadableStream
      const readableStream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          try {
            for await (const chunk of asyncIterator) {
              controller.enqueue(encoder.encode(chunk));
            }
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });

      return new Response(readableStream, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    return new Response("Not found", { status: 404, headers: corsHeaders });
  }
})

console.log(`Server is running on ${server.url}`);