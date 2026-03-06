import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { prisma } from '@vibe/database';
import * as fs from 'fs';
import * as path from 'path';

interface ChatPart {
  id: string;
  type: 'text' | 'tool' | 'file' | 'reasoning';
  content: string;
  metadata?: any;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  timestamp: number;
  parts: ChatPart[];
}

interface SessionInfo {
  title: string;
  directory: string;
}

interface ChatHistoryResponse {
  messages: ChatMessage[];
  sessionInfo?: SessionInfo;
  error?: string;
}

export async function getChatHistory(interviewId: string): Promise<ChatHistoryResponse> {
  try {
    // Get interview with dataDir
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId }
    });

    if (!interview) {
      return { messages: [], error: 'Interview not found' };
    }

    if (!interview.dataDir) {
      return { messages: [], error: 'No data directory found for this interview' };
    }

    // Construct database path
    const dbPath = path.join(interview.dataDir, 'opencode', 'opencode.db');

    // Check if database exists
    if (!fs.existsSync(dbPath)) {
      return { messages: [], error: 'Chat database not found. Interview may not have started yet.' };
    }

    // Open SQLite database
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
      mode: sqlite3.OPEN_READONLY
    });

    try {
      // Get session info
      let sessionInfo: SessionInfo | undefined;
      try {
        const sessionRow = await db.get('SELECT * FROM session LIMIT 1');
        if (sessionRow) {
          sessionInfo = {
            title: sessionRow.title || 'Interview Session',
            directory: sessionRow.directory || ''
          };
        }
      } catch (error) {
        console.error('Failed to fetch session info:', error);
      }

      // Get all messages
      const messageRows = await db.all(`
        SELECT id, session_id, time_created, data
        FROM message
        ORDER BY time_created ASC
      `);

      if (messageRows.length === 0) {
        return { messages: [], sessionInfo };
      }

      // Get all parts for these messages
      const messageIds = messageRows.map(row => row.id);
      const placeholders = messageIds.map(() => '?').join(',');
      const partRows = await db.all(`
        SELECT id, message_id, data
        FROM part
        WHERE message_id IN (${placeholders})
        ORDER BY id ASC
      `, ...messageIds);

      // Group parts by message
      const partsByMessage = new Map<string, any[]>();
      for (const partRow of partRows) {
        const parts = partsByMessage.get(partRow.message_id) || [];
        parts.push(partRow);
        partsByMessage.set(partRow.message_id, parts);
      }

      // Convert to ChatMessage format
      const messages: ChatMessage[] = messageRows.map(messageRow => {
        const messageData = JSON.parse(messageRow.data);
        const messageParts = partsByMessage.get(messageRow.id) || [];

        const parts: ChatPart[] = messageParts.map(partRow => {
          const partData = JSON.parse(partRow.data);
          return convertPartToChatPart(partRow.id, partData);
        }).filter(part => part !== null) as ChatPart[];

        return {
          id: messageRow.id,
          role: messageData.role === 'user' ? 'user' : 'assistant',
          timestamp: messageRow.time_created,
          parts
        };
      });

      return { messages, sessionInfo };
    } finally {
      await db.close();
    }
  } catch (error) {
    console.error('Error fetching chat history:', error);
    return { messages: [], error: 'Failed to fetch chat history' };
  }
}

function convertPartToChatPart(id: string, partData: any): ChatPart | null {
  const type = partData.type;

  switch (type) {
    case 'text':
      return {
        id,
        type: 'text',
        content: partData.text || '',
        metadata: partData.metadata
      };

    case 'reasoning':
      return {
        id,
        type: 'reasoning',
        content: partData.text || '',
        metadata: partData.metadata
      };

    case 'tool':
      const toolName = partData.tool || 'Unknown Tool';
      const toolState = partData.state?.status || 'unknown';
      let toolContent = `${toolName}`;

      if (toolState === 'completed') {
        toolContent += ' (completed)';
      } else if (toolState === 'error') {
        toolContent += ' (error)';
      } else if (toolState === 'running') {
        toolContent += ' (running)';
      }

      return {
        id,
        type: 'tool',
        content: toolContent,
        metadata: {
          tool: toolName,
          status: toolState,
          input: partData.state?.input,
          output: partData.state?.output,
          error: partData.state?.error
        }
      };

    case 'file':
      const filename = partData.filename || 'file';
      return {
        id,
        type: 'file',
        content: filename,
        metadata: {
          mime: partData.mime,
          url: partData.url
        }
      };

    default:
      // Skip other part types (step-start, step-finish, etc.)
      return null;
  }
}
