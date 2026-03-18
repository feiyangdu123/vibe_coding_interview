import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { prisma } from '@vibe/database';
import * as fs from 'fs';
import * as path from 'path';

export interface ChatPart {
  id: string;
  type: 'text' | 'tool' | 'file' | 'reasoning';
  content: string;
  metadata?: any;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  timestamp: number;
  parts: ChatPart[];
}

export interface SessionInfo {
  sessionId: string;
  title: string;
  directory: string;
  lastMessageTimestamp?: number;
}

export interface ChatHistoryResponse {
  sessionId?: string;
  lastMessageTimestamp?: number;
  messages: ChatMessage[];
  sessionInfo?: SessionInfo;
  error?: string;
}

function getDatabasePath(dataDir: string): string {
  return path.join(dataDir, 'opencode', 'opencode.db');
}

async function openReadonlyDatabase(dbPath: string) {
  return open({
    filename: dbPath,
    driver: sqlite3.Database,
    mode: sqlite3.OPEN_READONLY
  });
}

interface CanonicalSessionRow {
  id: string;
  title: string;
  directory: string;
  time_updated: number;
}

interface MessageRow {
  id: string;
  session_id: string;
  time_created: number;
  data: string;
}

interface PartRow {
  id: string;
  message_id: string;
  data: string;
}

async function getCanonicalSessionRow(db: Awaited<ReturnType<typeof openReadonlyDatabase>>): Promise<CanonicalSessionRow | null> {
  const activeSession = await db.get<CanonicalSessionRow>(`
    SELECT id, title, directory, time_updated
    FROM session
    WHERE time_archived IS NULL
    ORDER BY time_updated DESC
    LIMIT 1
  `);

  if (activeSession) {
    return activeSession;
  }

  const latestSession = await db.get<CanonicalSessionRow>(`
    SELECT id, title, directory, time_updated
    FROM session
    ORDER BY time_updated DESC
    LIMIT 1
  `);

  return latestSession ?? null;
}

export async function getChatHistoryFromDataDir(dataDir: string): Promise<ChatHistoryResponse> {
  try {
    if (!fs.existsSync(dataDir)) {
      console.error(`[Chat History] Data directory not found: ${dataDir}`);
      return { messages: [], error: `Data directory not found: ${dataDir}` };
    }

    const dbPath = getDatabasePath(dataDir);

    if (!fs.existsSync(dbPath)) {
      console.error(`[Chat History] Database file not found: ${dbPath}`);
      return { messages: [], error: `Database file not found: ${dbPath}. Interview may not have started yet.` };
    }

    try {
      fs.accessSync(dbPath, fs.constants.R_OK);
    } catch (err) {
      console.error(`[Chat History] Database file not readable: ${dbPath}`, err);
      return { messages: [], error: `Database file not readable: ${dbPath}. Permission denied.` };
    }

    console.log(`[Chat History] Opening database: ${dbPath}`);

    const db = await openReadonlyDatabase(dbPath);

    try {
      // Check if the session table exists (OpenCode may still be initializing)
      const tableCheck = await db.get<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='session'`
      );
      if (!tableCheck) {
        return { messages: [], error: 'OpenCode is still initializing, chat history not yet available.' };
      }

      const sessionRow = await getCanonicalSessionRow(db);
      if (!sessionRow) {
        return { messages: [] };
      }

      const messageRows = await db.all(`
        SELECT id, session_id, time_created, data
        FROM message
        WHERE session_id = ?
        ORDER BY time_created ASC
      `, sessionRow.id) as MessageRow[];

      const lastMessageTimestamp = messageRows.length > 0
        ? messageRows[messageRows.length - 1]?.time_created
        : undefined;
      const sessionInfo: SessionInfo = {
        sessionId: sessionRow.id,
        title: sessionRow.title || 'Interview Session',
        directory: sessionRow.directory || '',
        lastMessageTimestamp
      };

      if (messageRows.length === 0) {
        return {
          sessionId: sessionRow.id,
          lastMessageTimestamp,
          messages: [],
          sessionInfo
        };
      }

      const messageIds = messageRows.map(row => row.id);
      const placeholders = messageIds.map(() => '?').join(',');
      const partRows = await db.all(`
        SELECT id, message_id, data
        FROM part
        WHERE message_id IN (${placeholders})
        ORDER BY id ASC
      `, ...messageIds) as PartRow[];

      const partsByMessage = new Map<string, PartRow[]>();
      for (const partRow of partRows) {
        const parts = partsByMessage.get(partRow.message_id) || [];
        parts.push(partRow);
        partsByMessage.set(partRow.message_id, parts);
      }

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

      return {
        sessionId: sessionRow.id,
        lastMessageTimestamp,
        messages,
        sessionInfo
      };
    } finally {
      await db.close();
    }
  } catch (error) {
    console.error('Error fetching chat history:', error);
    return { messages: [], error: 'Failed to fetch chat history' };
  }
}

export async function getChatHistory(interviewId: string): Promise<ChatHistoryResponse> {
  try {
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId }
    });

    if (!interview) {
      return { messages: [], error: 'Interview not found' };
    }

    if (!interview.dataDir) {
      return { messages: [], error: 'No data directory found for this interview' };
    }
    return getChatHistoryFromDataDir(interview.dataDir);
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
