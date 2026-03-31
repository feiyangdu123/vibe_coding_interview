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

export interface SessionWithMessages {
  sessionInfo: SessionInfo;
  messages: ChatMessage[];
}

export interface ChatHistoryResponse {
  sessionId?: string;
  lastMessageTimestamp?: number;
  messages: ChatMessage[];
  sessionInfo?: SessionInfo;
  sessions: SessionWithMessages[];
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

async function getAllSessionRows(db: Awaited<ReturnType<typeof openReadonlyDatabase>>): Promise<CanonicalSessionRow[]> {
  // First try non-archived sessions
  const activeSessions = await db.all<CanonicalSessionRow[]>(`
    SELECT id, title, directory, time_updated
    FROM session
    WHERE time_archived IS NULL
    ORDER BY time_updated ASC
  `);

  if (activeSessions.length > 0) {
    return activeSessions;
  }

  // Fallback: return the latest session (even if archived)
  const latestSession = await db.get<CanonicalSessionRow>(`
    SELECT id, title, directory, time_updated
    FROM session
    ORDER BY time_updated DESC
    LIMIT 1
  `);

  return latestSession ? [latestSession] : [];
}

async function getMessagesForSession(
  db: Awaited<ReturnType<typeof openReadonlyDatabase>>,
  sessionRow: CanonicalSessionRow
): Promise<{ messages: ChatMessage[]; lastMessageTimestamp?: number }> {
  const messageRows = await db.all(`
    SELECT id, session_id, time_created, data
    FROM message
    WHERE session_id = ?
    ORDER BY time_created ASC
  `, sessionRow.id) as MessageRow[];

  const lastMessageTimestamp = messageRows.length > 0
    ? messageRows[messageRows.length - 1]?.time_created
    : undefined;

  if (messageRows.length === 0) {
    return { messages: [], lastMessageTimestamp };
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

  return { messages, lastMessageTimestamp };
}

export async function getChatHistoryFromDataDir(dataDir: string): Promise<ChatHistoryResponse> {
  try {
    if (!fs.existsSync(dataDir)) {
      console.error(`[Chat History] Data directory not found: ${dataDir}`);
      return { messages: [], sessions: [], error: `Data directory not found: ${dataDir}` };
    }

    const dbPath = getDatabasePath(dataDir);

    if (!fs.existsSync(dbPath)) {
      console.error(`[Chat History] Database file not found: ${dbPath}`);
      return { messages: [], sessions: [], error: `Database file not found: ${dbPath}. Interview may not have started yet.` };
    }

    try {
      fs.accessSync(dbPath, fs.constants.R_OK);
    } catch (err) {
      console.error(`[Chat History] Database file not readable: ${dbPath}`, err);
      return { messages: [], sessions: [], error: `Database file not readable: ${dbPath}. Permission denied.` };
    }

    console.log(`[Chat History] Opening database: ${dbPath}`);

    const db = await openReadonlyDatabase(dbPath);

    try {
      // Check if the session table exists (OpenCode may still be initializing)
      const tableCheck = await db.get<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='session'`
      );
      if (!tableCheck) {
        return { messages: [], sessions: [], error: 'OpenCode is still initializing, chat history not yet available.' };
      }

      const sessionRows = await getAllSessionRows(db);
      if (sessionRows.length === 0) {
        return { messages: [], sessions: [] };
      }

      // Build sessions array
      const sessions: SessionWithMessages[] = [];
      for (const sessionRow of sessionRows) {
        const { messages, lastMessageTimestamp } = await getMessagesForSession(db, sessionRow);
        sessions.push({
          sessionInfo: {
            sessionId: sessionRow.id,
            title: sessionRow.title || 'Interview Session',
            directory: sessionRow.directory || '',
            lastMessageTimestamp
          },
          messages
        });
      }

      // Backward compatibility: populate top-level fields from the last session
      const lastSession = sessions[sessions.length - 1];
      return {
        sessionId: lastSession.sessionInfo.sessionId,
        lastMessageTimestamp: lastSession.sessionInfo.lastMessageTimestamp,
        messages: lastSession.messages,
        sessionInfo: lastSession.sessionInfo,
        sessions
      };
    } finally {
      await db.close();
    }
  } catch (error) {
    console.error('Error fetching chat history:', error);
    return { messages: [], sessions: [], error: 'Failed to fetch chat history' };
  }
}

export async function getChatHistory(interviewId: string): Promise<ChatHistoryResponse> {
  try {
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId }
    });

    if (!interview) {
      return { messages: [], sessions: [], error: 'Interview not found' };
    }

    if (!interview.dataDir) {
      return { messages: [], sessions: [], error: 'No data directory found for this interview' };
    }
    return getChatHistoryFromDataDir(interview.dataDir);
  } catch (error) {
    console.error('Error fetching chat history:', error);
    return { messages: [], sessions: [], error: 'Failed to fetch chat history' };
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
