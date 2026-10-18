import { expect } from "chai";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  DEFAULT_DB_PATH,
  LATEST_SCHEMA_VERSION,
  getSchemaVersion,
  openDatabase,
  runMigrations,
} from "../helpers/db_helper.js";

describe("db_helper acceptance", () => {
  describe("migrations (in-memory)", () => {
    let db: DatabaseSync | undefined;

    afterEach(() => {
      db?.close();
      db = undefined;
    });

    it("A1: running migrations on a fresh database brings it to the latest schema version", () => {
      db = new DatabaseSync(":memory:");
      expect(getSchemaVersion(db)).to.equal(0);

      const result = runMigrations(db);

      expect(LATEST_SCHEMA_VERSION).to.be.a("number");
      expect(LATEST_SCHEMA_VERSION).to.be.at.least(1);
      expect(result).to.equal(LATEST_SCHEMA_VERSION);
      expect(getSchemaVersion(db)).to.equal(LATEST_SCHEMA_VERSION);
    });

    it("A2: running migrations again on an already-migrated database is a no-op with the same version and no error", () => {
      const memDb = new DatabaseSync(":memory:");
      db = memDb;
      const first = runMigrations(memDb);
      let second: number | undefined;

      expect(() => {
        second = runMigrations(memDb);
      }).to.not.throw();

      expect(LATEST_SCHEMA_VERSION).to.be.at.least(1);
      expect(first).to.equal(LATEST_SCHEMA_VERSION);
      expect(second).to.equal(LATEST_SCHEMA_VERSION);
      expect(getSchemaVersion(memDb)).to.equal(LATEST_SCHEMA_VERSION);
    });

    it("A3: the initial migration sets schema version 1 and creates no feature tables", () => {
      db = new DatabaseSync(":memory:");
      runMigrations(db);

      expect(getSchemaVersion(db)).to.equal(1);
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
        .all()
        .map((row) => row.name);
      expect(tables).to.deep.equal([]);
    });
  });

  describe("file-backed", () => {
    let dir: string;
    let db: DatabaseSync | undefined;
    let originalDbPath: string | undefined;
    let originalCwd: string;

    beforeEach(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), "ubot-db-acceptance-"));
      originalDbPath = process.env.DB_PATH;
      originalCwd = process.cwd();
    });

    afterEach(() => {
      db?.close();
      db = undefined;
      process.chdir(originalCwd);
      if (originalDbPath === undefined) {
        delete process.env.DB_PATH;
      } else {
        process.env.DB_PATH = originalDbPath;
      }
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it("A4: the database opens in WAL journal mode", () => {
      const fileDb = openDatabase(path.join(dir, "ubot.db"));
      db = fileDb;

      const row = fileDb.prepare("PRAGMA journal_mode").get();
      expect(String(row?.journal_mode).toLowerCase()).to.equal("wal");
    });

    it("A5: openDatabase() with no argument uses the DB_PATH env var and migrates that file", () => {
      const dbFile = path.join(dir, "nested", "custom.db");
      process.env.DB_PATH = dbFile;

      db = openDatabase();

      expect(fs.existsSync(dbFile)).to.equal(true);
      expect(LATEST_SCHEMA_VERSION).to.be.at.least(1);
      expect(getSchemaVersion(db)).to.equal(LATEST_SCHEMA_VERSION);
    });

    it("A5: DEFAULT_DB_PATH is data/ubot.db", () => {
      expect(DEFAULT_DB_PATH).to.equal("data/ubot.db");
    });

    it("A5: openDatabase() with DB_PATH unset creates data/ubot.db relative to cwd", () => {
      delete process.env.DB_PATH;
      process.chdir(dir);

      db = openDatabase();

      expect(fs.existsSync(path.join(dir, "data", "ubot.db"))).to.equal(true);
      expect(LATEST_SCHEMA_VERSION).to.be.at.least(1);
      expect(getSchemaVersion(db)).to.equal(LATEST_SCHEMA_VERSION);
    });
  });
});
