import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const requireModule = createRequire(path.resolve(process.cwd(), 'package.json'));

export interface SqlitePreparedStatement {
  run(...params: unknown[]): unknown;
  get(...params: unknown[]): Record<string, unknown> | undefined | null;
  all(...params: unknown[]): Array<Record<string, unknown>>;
}

export interface SqliteDatabaseDriver {
  exec(sql: string): void;
  prepare(sql: string): SqlitePreparedStatement;
  transaction<TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => TResult
  ): (...args: TArgs) => TResult;
  close(): void;
}

export function createSqliteDriver(dbFilePath: string): SqliteDatabaseDriver {
  const isMemory = dbFilePath === ':memory:';
  if (!isMemory) {
    const dir = path.dirname(dbFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const isBunRuntime =
    typeof (globalThis as Record<string, unknown>).Bun !== 'undefined';

  if (isBunRuntime) {
    const { Database } = requireModule('bun:sqlite') as {
      Database: new (filename: string) => {
        exec(sql: string): void;
        prepare(sql: string): SqlitePreparedStatement;
        transaction<TArgs extends unknown[], TResult>(
          fn: (...args: TArgs) => TResult
        ): (...args: TArgs) => TResult;
        close(): void;
      };
    };
    const db = new Database(dbFilePath);
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec('PRAGMA synchronous = NORMAL;');
    db.exec('PRAGMA busy_timeout = 5000;');
    return db;
  }

  const { DatabaseSync } = requireModule('node:sqlite') as {
    DatabaseSync: new (filename: string) => {
      exec(sql: string): void;
      prepare(sql: string): SqlitePreparedStatement;
      close(): void;
    };
  };
  const nodeDb = new DatabaseSync(dbFilePath);
  nodeDb.exec('PRAGMA journal_mode = WAL;');
  nodeDb.exec('PRAGMA foreign_keys = ON;');
  nodeDb.exec('PRAGMA synchronous = NORMAL;');
  nodeDb.exec('PRAGMA busy_timeout = 5000;');

  let txDepth = 0;
  return {
    exec: (sql: string) => nodeDb.exec(sql),
    prepare: (sql: string) => nodeDb.prepare(sql),
    transaction: <TArgs extends unknown[], TResult>(
      fn: (...args: TArgs) => TResult
    ) => {
      return (...args: TArgs): TResult => {
        const isOuter = txDepth === 0;
        txDepth += 1;
        if (isOuter) {
          nodeDb.exec('BEGIN IMMEDIATE TRANSACTION;');
        }
        try {
          const result = fn(...args);
          if (isOuter) {
            nodeDb.exec('COMMIT;');
          }
          return result;
        } catch (err) {
          if (isOuter) {
            try {
              nodeDb.exec('ROLLBACK;');
            } catch {
              // ignore rollback error
            }
          }
          throw err;
        } finally {
          txDepth = Math.max(0, txDepth - 1);
        }
      };
    },
    close: () => nodeDb.close(),
  };
}

export function ensureColumnExists(
  db: SqliteDatabaseDriver,
  tableName: string,
  columnName: string,
  columnDefSql: string
): void {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const hasColumn = columns.some((col) => String(col.name) === columnName);
  if (!hasColumn) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefSql};`);
  }
}
