import { groqService } from './services/groq';
import { cerebrasService } from './services/cerebras';
import { geminiService } from './services/gemini';
import { openrouterService } from './services/openrouter';
import { sambanovaService } from './services/sambanova';
import type { AIService, ChatMessage } from './types';
import { initDb, saveMessage, getHistory, createConversation, deleteConversation, getConversationMessages, getMessage, deleteMessage, listConversations, deleteAllConversations } from "./db";

// Initialize database
await initDb().catch(err => console.error("DB Init Error:", err));

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
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Expose-Headers': 'X-Service-Name, X-Request-ID, X-Model-Name',
    };

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // History endpoint
    if (req.method === 'GET' && pathname === '/history') {
      try {
        const history = await getHistory(50);
        return new Response(JSON.stringify(history), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to fetch history' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Health check and UI
    if (req.method === 'GET') {
      if (pathname === '/') {
        return new Response(Bun.file('public/index.html'), {
          headers: { ...corsHeaders, 'Content-Type': 'text/html' },
        });
      }
      
      // Serve static files
      if (pathname === '/index.css' || pathname === '/index.js') {
        const file = Bun.file(`public${pathname}`);
        if (await file.exists()) {
          return new Response(file, {
            headers: { ...corsHeaders, 'Content-Type': file.type },
          });
        }
      }

      if (pathname === '/api/health') {
        return new Response(JSON.stringify({ 
          status: 'ok', 
          services: services.map(s => s.name),
          timestamp: new Date().toISOString()
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // API Endpoints
    if (pathname.startsWith('/api')) {
      // GET /api/conversations
      if (req.method === 'GET' && pathname === '/api/conversations') {
          const conversations = await listConversations();
          return new Response(JSON.stringify(conversations), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
      }

      // POST /api/conversations
      if (req.method === 'POST' && pathname === '/api/conversations') {
        const { title } = await req.json() as { title?: string };
        const conversation = await createConversation(title);
        return new Response(JSON.stringify(conversation[0]), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // DELETE /api/conversations/:id OR DELETE /api/conversations
      if (req.method === 'DELETE' && pathname.startsWith('/api/conversations')) {
          const parts = pathname.split('/').filter(p => p !== '');
          const id = parts.length === 3 ? parts[2] : null;

          if (id) {
              const deleted = await deleteConversation(id);
              return new Response(JSON.stringify({ success: true, deleted: deleted[0] }), {
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
          } else {
              // DELETE ALL
              const deleted = await deleteAllConversations();
              return new Response(JSON.stringify({ success: true, count: deleted.length }), {
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
          }
      }

      // GET /api/conversations/:id/messages
      if (req.method === 'GET' && pathname.startsWith('/api/conversations/') && pathname.endsWith('/messages')) {
          const id = pathname.split('/')[3];
          if (id) {
              const messages = await getConversationMessages(id);
              return new Response(JSON.stringify(messages), {
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
          }
      }

      // GET /api/messages/:id
      if (req.method === 'GET' && pathname.startsWith('/api/messages/')) {
          const id = pathname.split('/').pop();
          if (id) {
              const message = await getMessage(id);
              return new Response(JSON.stringify(message[0] || null), {
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
          }
      }

      // DELETE /api/messages/:id
      if (req.method === 'DELETE' && pathname.startsWith('/api/messages/')) {
          const id = pathname.split('/').pop();
          if (id) {
              const deleted = await deleteMessage(id);
              return new Response(JSON.stringify({ success: true, deleted: deleted[0] }), {
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
          }
      }
    }

    if (req.method === 'POST' && pathname === '/chat') {
      const { messages, service: requestedServiceName, conversationId } = await req.json() as { messages: ChatMessage[], service?: string, conversationId?: string };
      const requestId = globalThis.crypto.randomUUID();
      
      const service = requestedServiceName 
        ? services.find(s => s.name === requestedServiceName) 
        || getNextService()
        : getNextService();

      console.log(`[${requestId}] Using ${service?.name} service`);
      
      if (!service) {
        return new Response(JSON.stringify({ error: 'No service available' }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Save user message
      const lastUserMessage = messages && messages.length > 0 ? messages[messages.length - 1] : null;
      if (lastUserMessage) {
        await saveMessage({
          requestId,
          role: lastUserMessage.role,
          content: lastUserMessage.content,
          service: service.name,
          model: service.model,
          conversationId,
        }).catch(err => console.error('Error saving user message:', err));
      }

      const asyncIterator = await service.chat(messages);

      // Convert AsyncGenerator to ReadableStream
      const readableStream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          let fullResponse = '';
          try {
            for await (const chunk of asyncIterator) {
              fullResponse += chunk;
              controller.enqueue(encoder.encode(chunk));
            }

            // Save assistant message when stream is done
            await saveMessage({
              requestId,
              role: 'assistant',
              content: fullResponse,
              service: service.name,
              model: service.model,
              conversationId,
            }).catch(err => console.error('Error saving assistant message:', err));

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
          'X-Service-Name': service.name,
          'X-Model-Name': service.model,
          'X-Request-ID': requestId,
        },
      });
    }

    return new Response("Not found", { status: 404, headers: corsHeaders });
  }
})

console.log(`Server is running on ${server.url}`);