import { FastifyRequest, FastifyReply } from 'fastify';
import { db } from './db';
import { randomBytes } from 'crypto';

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 часа

export function createSession(userId: number): string {
  const sessionId = randomBytes(32).toString('hex');
  // Используем формат SQLite datetime для совместимости
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d{3}Z$/, '');
  
  db.prepare('INSERT INTO sessions (id, userId, expiresAt) VALUES (?, ?, ?)')
    .run(sessionId, userId, expiresAt);
  
  return sessionId;
}

export function getSession(sessionId: string): { userId: number } | null {
  // Используем datetime('now') для сравнения с expiresAt в формате SQLite
  const session = db.prepare(`
    SELECT userId FROM sessions 
    WHERE id = ? AND datetime(expiresAt) > datetime('now')
  `).get(sessionId) as { userId: number } | undefined;
  
  if (!session) {
    return null;
  }
  
  return session;
}

export function deleteSession(sessionId: string) {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

export function cleanupExpiredSessions() {
  db.prepare("DELETE FROM sessions WHERE datetime(expiresAt) <= datetime('now')").run();
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const sessionId = request.cookies.session;
  
  if (!sessionId) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }
  
  const session = getSession(sessionId);
  
  if (!session) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }
  
  (request as any).userId = session.userId;
}
