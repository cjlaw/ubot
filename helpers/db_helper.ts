import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export const DEFAULT_DB_PATH = "data/ubot.db";

// Migration n is migrations[n - 1]. Never edit or reorder shipped entries; append only.
const migrations: string[] = [
  "",
];

export const LATEST_SCHEMA_VERSION = migrations.length;

export function getSchemaVersion(db: DatabaseSync): number {
  const row = db.prepare("PRAGMA user_version").get();
  return Number(row?.user_version ?? 0);
}

export function runMigrations(db: DatabaseSync): number {
  let version = getSchemaVersion(db);
  for (let next = version + 1; next <= LATEST_SCHEMA_VERSION; next++) {
    db.exec("BEGIN");
    try {
      db.exec(migrations[next - 1]);
      db.exec(`PRAGMA user_version = ${next}`);
      db.exec("COMMIT");
    } catch (err) {
      try {
        db.exec("ROLLBACK");
      } catch {
        // Keep the original migration error; a failed rollback would mask it.
      }
      throw err;
    }
    version = next;
  }
  return version;
}

export function openDatabase(path: string = process.env.DB_PATH || DEFAULT_DB_PATH): DatabaseSync {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  if (path !== ":memory:") {
    const mode = String(db.prepare("PRAGMA journal_mode = WAL").get()?.journal_mode);
    if (mode !== "wal") {
      db.close();
      throw new Error(`Could not enable WAL journal mode for ${path} (got "${mode}")`);
    }
  }
  try {
    runMigrations(db);
  } catch (err) {
    db.close();
    throw err;
  }
  return db;
}
