import { FastifyRequest, FastifyReply } from 'fastify';
import { db } from './db';
import { randomBytes } from 'crypto';

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 часа

export function createSession(userId: number): string {
  const sessionId = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
  
  db.prepare('INSERT INTO sessions (id, userId, expiresAt) VALUES (?, ?, ?)')
    .run(sessionId, userId, expiresAt);
  
  return sessionId;
}

export function getSession(sessionId: string): { userId: number } | null {
  const session = db.prepare(`
    SELECT userId FROM sessions 
    WHERE id = ? AND expiresAt > datetime('now')
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
  db.prepare("DELETE FROM sessions WHERE expiresAt <= datetime('now')").run();
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
