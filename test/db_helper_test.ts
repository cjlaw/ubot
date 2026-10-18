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
});
