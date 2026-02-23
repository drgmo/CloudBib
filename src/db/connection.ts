/**
 * CloudBib — Database Connection & Migration Runner
 *
 * Manages SQLite connections and applies schema migrations.
 */

import Database from 'better-sqlite3';
import { MIGRATIONS, getBootstrapSQL } from './schema';

export interface DatabaseConnection {
  db: Database.Database;
  close(): void;
}

/**
 * Opens (or creates) a SQLite database at `dbPath` and runs pending migrations.
 */
export function openDatabase(dbPath: string): DatabaseConnection {
  const db = new Database(dbPath);

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Run migrations
  applyMigrations(db);

  return {
    db,
    close() {
      db.close();
    },
  };
}

/**
 * Applies all pending migrations in order.
 */
export function applyMigrations(db: Database.Database): void {
  // Ensure the _migrations table exists
  db.exec(getBootstrapSQL());

  const applied = new Set<number>();
  const rows = db.prepare('SELECT version FROM _migrations').all() as Array<{ version: number }>;
  for (const row of rows) {
    applied.add(row.version);
  }

  for (const migration of MIGRATIONS) {
    if (!applied.has(migration.version)) {
      db.transaction(() => {
        // Split multi-statement SQL and execute each
        const statements = migration.sql
          .split(';')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        for (const stmt of statements) {
          db.exec(stmt + ';');
        }

        db.prepare('INSERT INTO _migrations (version, name) VALUES (?, ?)').run(
          migration.version,
          migration.name
        );
      })();
    }
  }
}
