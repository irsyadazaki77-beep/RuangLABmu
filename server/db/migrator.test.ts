import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  RuangLabDatabase,
  backupDatabase,
} from './database';
import {
  listAppliedMigrations,
  runMigrations,
} from './migrator';

const tempDirs: string[] = [];

function createTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('SQLite Versioned Migrations & VACUUM INTO Backup', () => {
  it('applies 001_initial_schema.sql and records version in schema_migrations idempotently', () => {
    const tmpDir = createTempDir('ruanglabmu-migrator-init-');
    const dbFile = path.join(tmpDir, 'test.db');

    const dbInstance = new RuangLabDatabase(dbFile);
    try {
      const applied = listAppliedMigrations(dbInstance.db);
      assert.equal(applied.length, 1);
      assert.equal(applied[0].version, 1);
      assert.equal(applied[0].name, '001_initial_schema.sql');

      // Re-running migrations is idempotent and applies 0 new migrations
      const secondRun = runMigrations(dbInstance.db);
      assert.equal(secondRun.length, 0);
      assert.equal(listAppliedMigrations(dbInstance.db).length, 1);
    } finally {
      dbInstance.close();
    }
  });

  it('executes sequential numbered migrations atomically and rolls back failing SQL migrations', () => {
    const tmpDir = createTempDir('ruanglabmu-migrator-seq-');
    const migrationsDir = path.join(tmpDir, 'migrations');
    fs.mkdirSync(migrationsDir, { recursive: true });

    fs.writeFileSync(
      path.join(migrationsDir, '002_create_items.sql'),
      'CREATE TABLE items (id INTEGER PRIMARY KEY, label TEXT NOT NULL);',
      'utf-8'
    );
    fs.writeFileSync(
      path.join(migrationsDir, '003_seed_items.sql'),
      "INSERT INTO items (id, label) VALUES (1, 'Neraca Ohauss');",
      'utf-8'
    );

    const dbInstance = new RuangLabDatabase(':memory:');
    try {
      const applied1 = runMigrations(dbInstance.db, migrationsDir);
      assert.equal(applied1.length, 2);
      assert.deepEqual(
        applied1.map((m) => m.version),
        [2, 3]
      );

      // Add a broken 004 migration that partially executes then fails
      fs.writeFileSync(
        path.join(migrationsDir, '004_broken.sql'),
        "INSERT INTO items (id, label) VALUES (2, 'ShouldRollback'); INVALID SQL SYNTAX HERE;",
        'utf-8'
      );

      assert.throws(() => {
        runMigrations(dbInstance.db, migrationsDir);
      });

      // Row from 004 must have rolled back atomically and 004 must not be in schema_migrations
      const countRow = dbInstance.db
        .prepare('SELECT COUNT(*) AS cnt FROM items WHERE id = 2')
        .get();
      assert.equal(Number(countRow?.cnt ?? -1), 0);

      const appliedAfterFail = listAppliedMigrations(dbInstance.db);
      assert.equal(
        appliedAfterFail.some((m) => m.version === 4),
        false
      );
    } finally {
      dbInstance.close();
    }
  });

  it('creates a consistent standalone SQLite backup using VACUUM INTO', () => {
    const tmpDir = createTempDir('ruanglabmu-vacuum-backup-');
    const primaryDbPath = path.join(tmpDir, 'primary.db');
    const backupDbPath = path.join(tmpDir, 'backups', 'snapshot.db');

    const primaryDb = new RuangLabDatabase(primaryDbPath);
    try {
      primaryDb.upsertRoom({
        pin: '918273',
        hostId: 'teacher-1',
        moduleDomain: 'chemistry',
        status: 'active',
      });
      primaryDb.upsertGradebookEntry({
        id: 'SUB-BACKUP-1',
        roomPin: '918273',
        studentId: 'stu-09',
        studentName: 'Dewi Lestari',
        moduleId: 'acid-base-titration',
        score: 94.5,
        rubricJson: JSON.stringify({ accuracy: 30 }),
      });

      const resolvedBackup = backupDatabase(primaryDb, backupDbPath);
      assert.equal(resolvedBackup, path.resolve(backupDbPath));
      assert.equal(fs.existsSync(resolvedBackup), true);
      assert.ok(fs.statSync(resolvedBackup).size > 0);
    } finally {
      primaryDb.close();
    }

    // Open backup file independently and verify data & migration history survived
    const restoredDb = new RuangLabDatabase(backupDbPath);
    try {
      const room = restoredDb.getRoomByPin('918273');
      assert.ok(room);
      assert.equal(room.module_domain, 'chemistry');

      const grade = restoredDb.getGradebookEntryById('SUB-BACKUP-1');
      assert.ok(grade);
      assert.equal(grade.student_name, 'Dewi Lestari');
      assert.equal(grade.score, 94.5);

      const migrations = listAppliedMigrations(restoredDb.db);
      assert.equal(migrations[0]?.version, 1);
    } finally {
      restoredDb.close();
    }
  });
});
