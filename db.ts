import { sql } from "bun";

export async function initDb() {
  // Create conversations table first
  await sql`
    CREATE TABLE IF NOT EXISTS conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  // Create/Update chat_messages table
  await sql`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
      request_id UUID NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      service TEXT,
      model TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  
  // Ensure conversation_id column exists if table was already there
  await sql`
    ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE;
  `;

  console.log("Database initialized");
}

export async function createConversation(title?: string) {
  return await sql`
    INSERT INTO conversations (title)
    VALUES (${title || 'New Conversation'})
    RETURNING *;
  `;
}

export async function deleteConversation(id: string) {
  return await sql`
    DELETE FROM conversations WHERE id = ${id}
    RETURNING *;
  `;
}

export async function getConversationMessages(conversationId: string) {
  return await sql`
    SELECT * FROM chat_messages
    WHERE conversation_id = ${conversationId}
    ORDER BY created_at ASC;
  `;
}

export async function getMessage(id: string) {
  return await sql`
    SELECT * FROM chat_messages WHERE id = ${id};
  `;
}

export async function deleteMessage(id: string) {
  return await sql`
    DELETE FROM chat_messages WHERE id = ${id}
    RETURNING *;
  `;
}

export async function saveMessage(params: {
  requestId: string;
  role: string;
  content: string;
  service?: string;
  model?: string;
  conversationId?: string;
}) {
  return await sql`
    INSERT INTO chat_messages (request_id, role, content, service, model, conversation_id)
    VALUES (${params.requestId}, ${params.role}, ${params.content}, ${params.service || null}, ${params.model || null}, ${params.conversationId || null})
    RETURNING *;
  `;
}

export async function getHistory(limit: number = 50) {
  return await sql`
    SELECT * FROM chat_messages
    ORDER BY created_at DESC
    LIMIT ${limit};
  `;
}

export async function listConversations() {
  return await sql`
    SELECT * FROM conversations
    ORDER BY created_at DESC;
  `;
}

export async function deleteAllConversations() {
  await sql`DELETE FROM chat_messages;`;
  return await sql`
    DELETE FROM conversations
    RETURNING *;
  `;
}
