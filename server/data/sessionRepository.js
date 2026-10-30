import { createHash, randomBytes } from 'node:crypto';

const hashToken = (token) => createHash('sha256').update(token).digest('hex');

/**
 * Sessions are stored by SHA-256 of the token so a leaked database can't be used to hijack sessions.
 */
export function createSessionRepository(db) {
  return {
    create(userId, ttlMs) {
      const token = randomBytes(32).toString('base64url');
      const expiresAt = new Date(Date.now() + ttlMs).toISOString();
      db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(
        hashToken(token),
        userId,
        expiresAt
      );
      return { token, expiresAt };
    },

    findUserId(token) {
      const row = db
        .prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?')
        .get(hashToken(token));
      if (!row) return null;
      if (row.expires_at <= new Date().toISOString()) {
        this.delete(token);
        return null;
      }
      return row.user_id;
    },

    delete(token) {
      db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
    },

    purgeExpired() {
      db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(new Date().toISOString());
    },
  };
}
