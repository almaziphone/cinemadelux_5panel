import { FastifyInstance } from 'fastify';
import { db } from '../db.js';
import { createSession, deleteSession } from '../auth.js';

export async function authRoutes(fastify: FastifyInstance) {
  // Логин
  fastify.post('/api/auth/login', async (request, reply) => {
    const { username, password } = request.body as { username?: string; password?: string };
    
    if (!username || !password) {
      return reply.code(400).send({ error: 'Username and password required' });
    }
    
    const user = db.prepare('SELECT id, username, passwordHash FROM users WHERE username = ?')
      .get(username) as { id: number; username: string; passwordHash: string } | undefined;
    
    if (!user || user.passwordHash !== password) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }
    
    const sessionId = createSession(user.id);
    
    reply.setCookie('session', sessionId, {
      httpOnly: true,
      secure: false, // В продакшене должно быть true для HTTPS
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 часа
      path: '/'
    });
    
    return { success: true, user: { id: user.id, username: user.username } };
  });
  
  // Логаут
  fastify.post('/api/auth/logout', async (request, reply) => {
    const sessionId = request.cookies.session;
    
    if (sessionId) {
      deleteSession(sessionId);
    }
    
    reply.clearCookie('session', { path: '/' });
    return { success: true };
  });
  
  // Текущий пользователь
  fastify.get('/api/me', async (request, reply) => {
    const sessionId = request.cookies.session;
    
    if (!sessionId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    
    const { getSession } = await import('../auth.js');
    const session = getSession(sessionId);
    
    if (!session) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    
    const user = db.prepare('SELECT id, username FROM users WHERE id = ?')
      .get(session.userId) as { id: number; username: string } | undefined;
    
    if (!user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    
    return { user };
  });
}
