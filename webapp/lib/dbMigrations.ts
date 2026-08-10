import { createHash } from 'crypto';
import { readdir, readFile } from 'fs/promises';
import path from 'path';
import type { Pool } from 'mysql2/promise';

type DbError = { code?: string; message?: string };

const safeExistingObjectErrors = new Set([
  'ER_DUP_FIELDNAME',
  'ER_DUP_KEYNAME',
  'ER_FK_DUP_NAME',
  'ER_TABLE_EXISTS_ERROR'
]);

function migrationDirectories() {
  return [
    path.resolve(process.cwd(), '..', 'database', 'migrations'),
    path.resolve(process.cwd(), 'database', 'migrations')
  ];
}

async function findMigrationDirectory() {
  for (const directory of migrationDirectories()) {
    try {
      await readdir(directory);
      return directory;
    } catch {
      // Try the next deployment layout.
    }
  }
  return null;
}

function statementsFromSql(sql: string) {
  return sql
    .split(/\r?\n/)
    .filter(line => !line.trimStart().startsWith('--'))
    .join('\n')
    .split(';')
    .map(statement => statement.trim()
      // MariaDB/MySQL versions differ on ALTER ... IF NOT EXISTS support.
      // Duplicate-object errors are handled consistently below instead.
      .replace(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS/gi, 'ADD COLUMN')
      .replace(/ADD\s+INDEX\s+IF\s+NOT\s+EXISTS/gi, 'ADD INDEX'))
    .filter(Boolean);
}

export async function runPendingMigrations(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) PRIMARY KEY,
      checksum CHAR(64) NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const directory = await findMigrationDirectory();
  if (!directory) {
    console.warn('[DB] No database/migrations directory found; skipped SQL migrations');
    return;
  }

  const filesWithSql = await Promise.all(
    (await readdir(directory))
      .filter(name => name.toLowerCase().endsWith('.sql'))
      .map(async name => ({ name, sql: await readFile(path.join(directory, name), 'utf8') }))
  );

  // Bootstrap CREATE TABLE migrations before ALTER migrations. This keeps
  // older, non-numbered migration sets compatible on their first automatic run.
  filesWithSql.sort((a, b) => {
    const createDifference = Number(!/CREATE\s+TABLE/i.test(a.sql)) - Number(!/CREATE\s+TABLE/i.test(b.sql));
    return createDifference || a.name.localeCompare(b.name);
  });

  const [appliedRows] = await pool.query('SELECT name, checksum FROM schema_migrations');
  const applied = new Map((appliedRows as { name: string; checksum: string }[]).map(row => [row.name, row.checksum]));

  for (const migration of filesWithSql) {
    const checksum = createHash('sha256').update(migration.sql).digest('hex');
    if (applied.has(migration.name)) {
      if (applied.get(migration.name) !== checksum) {
        console.warn(`[DB] Migration ${migration.name} changed after it was applied; keeping database history unchanged`);
      }
      continue;
    }

    const connection = await pool.getConnection();
    try {
      for (const statement of statementsFromSql(migration.sql)) {
        try {
          await connection.query(statement);
        } catch (error) {
          const dbError = error as DbError;
          if (!safeExistingObjectErrors.has(dbError.code || '')) throw error;
        }
      }
      await connection.query('INSERT INTO schema_migrations (name, checksum) VALUES (?, ?)', [migration.name, checksum]);
      console.log(`[DB] Applied SQL migration: ${migration.name}`);
    } finally {
      connection.release();
    }
  }
}
