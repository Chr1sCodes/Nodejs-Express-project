const toUser = (row) =>
  row && { id: row.id, name: row.name, email: row.email, createdAt: row.created_at };

export function createUserRepository(db) {
  return {
    create({ name, email, passwordHash }) {
      const { lastInsertRowid } = db
        .prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
        .run(name, email, passwordHash);
      return this.findById(lastInsertRowid);
    },

    findById(id) {
      return toUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id));
    },

    /** Returns the user plus their password hash, for credential checks only. */
    findCredentialsByEmail(email) {
      const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      return row && { user: toUser(row), passwordHash: row.password_hash };
    },

    emailExists(email) {
      return Boolean(db.prepare('SELECT 1 FROM users WHERE email = ?').get(email));
    },
  };
}
