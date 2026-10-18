import { expect } from "chai";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  LATEST_SCHEMA_VERSION,
  getSchemaVersion,
  openDatabase,
  runMigrations,
} from "../helpers/db_helper.js";

describe("db_helper", () => {
  let dir: string;
  let db: DatabaseSync | undefined;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "ubot-db-"));
  });

  afterEach(() => {
    db?.close();
    db = undefined;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("creates missing parent directories when opening a file database", () => {
    const file = path.join(dir, "missing", "sub", "x.db");

    db = openDatabase(file);

    expect(fs.existsSync(file)).to.equal(true);
    expect(getSchemaVersion(db)).to.equal(LATEST_SCHEMA_VERSION);
  });

  it("leaves a database with a newer schema version untouched", () => {
    db = new DatabaseSync(":memory:");
    const newer = LATEST_SCHEMA_VERSION + 5;
    db.exec(`PRAGMA user_version = ${newer}`);

    let result: number | undefined;
    expect(() => {
      result = runMigrations(db as DatabaseSync);
    }).to.not.throw();

    expect(result).to.equal(newer);
    expect(getSchemaVersion(db)).to.equal(newer);
  });

  it("throws and closes the handle when WAL cannot be enabled", () => {
    const file = path.join(dir, "nowal.db");
    const proto = DatabaseSync.prototype;
    /* eslint-disable @typescript-eslint/unbound-method */
    const originalPrepare = proto.prepare;
    const originalClose = proto.close;
    /* eslint-enable @typescript-eslint/unbound-method */
    let closed = false;
    proto.prepare = function(this: DatabaseSync, sql: string) {
      if (sql.startsWith("PRAGMA journal_mode")) {
        return { get: () => ({ journal_mode: "delete" }) } as unknown as ReturnType<DatabaseSync["prepare"]>;
      }
      return originalPrepare.call(this, sql);
    };
    proto.close = function(this: DatabaseSync) {
      closed = true;
      originalClose.call(this);
    };
    try {
      expect(() => openDatabase(file)).to.throw(/delete.*nowal\.db|nowal\.db.*delete/);
    } finally {
      proto.prepare = originalPrepare;
      proto.close = originalClose;
    }
    expect(closed).to.equal(true);
  });

  describe("when a migration step fails", () => {
    const proto = DatabaseSync.prototype;
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const originalExec = proto.exec;
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const originalClose = proto.close;

    afterEach(() => {
      proto.exec = originalExec;
      proto.close = originalClose;
    });

    it("closes the handle and rethrows when migrations fail in openDatabase", () => {
      let closed = false;
      proto.exec = function(this: DatabaseSync, sql: string) {
        if (sql.startsWith("PRAGMA user_version =")) throw new Error("migration boom");
        return originalExec.call(this, sql);
      };
      proto.close = function(this: DatabaseSync) {
        closed = true;
        originalClose.call(this);
      };

      expect(() => openDatabase(":memory:")).to.throw("migration boom");
      expect(closed).to.equal(true);
    });

    it("rethrows the original migration error when ROLLBACK also fails", () => {
      db = new DatabaseSync(":memory:");
      proto.exec = function(this: DatabaseSync, sql: string) {
        if (sql.startsWith("PRAGMA user_version =")) throw new Error("migration boom");
        if (sql === "ROLLBACK") throw new Error("rollback boom");
        return originalExec.call(this, sql);
      };

      expect(() => runMigrations(db as DatabaseSync)).to.throw("migration boom");
    });
  });
});
