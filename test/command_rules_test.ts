import { expect } from "chai";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SlashCommandBuilder } from "discord.js";
import { checkCommands, loadCommands } from "./support/command_rules.js";
import type { CommandEntry } from "./support/command_rules.js";

type Json = Record<string, unknown>;

const fixture = (file: string, json: Json): CommandEntry => ({
  file,
  module: { data: { toJSON: () => json }, execute: async () => {} },
});

const has = (findings: string[], ...parts: string[]) => findings.some((f) => parts.every((p) => f.includes(p)));

describe("#helper: command_rules", () => {
  describe("-loadCommands", () => {
    let dir: string;

    before(() => {
      dir = mkdtempSync(join(tmpdir(), "ubot-cmdrules-unit-"));
      writeFileSync(join(dir, "package.json"), JSON.stringify({ type: "module" }));
      writeFileSync(
        join(dir, "ok.ts"),
        'export const data = { toJSON: () => ({ name: "ok", description: "d" }) }; export const execute = async () => {};\n',
      );
      writeFileSync(join(dir, "throws.ts"), 'throw new Error("import failure");\nexport {};\n');
      writeFileSync(join(dir, "types.d.ts"), "export declare const x: number;\n");
      writeFileSync(join(dir, "plain.js"), "export const data = 1;\n");
      mkdirSync(join(dir, "sub"));
      writeFileSync(join(dir, "sub", "deep.ts"), "export const x = 1;\n");
    });

    after(() => {
      rmSync(dir, { recursive: true, force: true });
    });

    it("returns exactly the top-level .ts entries and captures import errors", async () => {
      const entries = await loadCommands(dir);
      expect(entries.map((e) => e.file)).to.deep.equal(["ok.ts", "throws.ts"]);
      expect(entries[0].loadError).to.equal(undefined);
      expect(entries[1].loadError).to.not.equal(undefined);
      const findings = checkCommands(entries);
      expect(has(findings, "throws", "definition-error")).to.equal(true);
      expect(findings).to.have.length(1);
    });
  });

  describe("-error attribution", () => {
    it("toJSON throwing yields definition-error naming the file-derived command", () => {
      const findings = checkCommands([
        { file: "thrower.ts", module: { data: { toJSON: () => { throw new Error("nope"); } }, execute: async () => {} } },
      ]);
      expect(has(findings, "thrower", "definition-error", "nope")).to.equal(true);
    });

    it("a real builder violation reports the constraint details", () => {
      const findings = checkCommands([
        {
          file: "okfile.ts",
          module: {
            data: { toJSON: () => new SlashCommandBuilder().setName("ok").setDescription("x".repeat(101)).toJSON() },
            execute: async () => {},
          },
        },
      ]);
      expect(has(findings, "okfile", "definition-error", "<= 100")).to.equal(true);
    });

    it("malformed JSON does not throw and reports name-format and description-length", () => {
      const entry: CommandEntry = {
        file: "weird.ts",
        module: { data: { toJSON: () => ({ name: 5, options: "nope" }) }, execute: async () => {} },
      };
      let findings: string[] = [];
      expect(() => { findings = checkCommands([entry]); }).to.not.throw();
      expect(has(findings, "name-format")).to.equal(true);
      expect(has(findings, "description-length")).to.equal(true);
    });

    it("a load failure whose basename matches another command's name is not a duplicate", () => {
      const findings = checkCommands([
        { file: "same.ts", loadError: new Error("x") },
        fixture("other.ts", { name: "same", description: "d" }),
      ]);
      expect(has(findings, "definition-error")).to.equal(true);
      expect(has(findings, "duplicate-command")).to.equal(false);
    });
  });

  describe("-nested level", () => {
    const opt = (name: string, extra: Json = {}): Json => ({ type: 3, name, description: "d", ...extra });

    it("reports one finding per rule, naming the subcommand", () => {
      const tooMany = Array.from({ length: 26 }, (_, i) => opt(`o${i}`));
      const findings = checkCommands([
        fixture("n.ts", {
          name: "nest",
          description: "d",
          options: [
            { type: 1, name: "ordersub", description: "d", options: [opt("a"), opt("b", { required: true })] },
            { type: 1, name: "dupsub", description: "d", options: [opt("q"), opt("q")] },
            { type: 1, name: "bigsub", description: "d", options: tooMany },
            { type: 1, name: "descsub", description: "d", options: [opt("e", { description: "" })] },
          ],
        }),
      ]);
      expect(has(findings, "required-order", 'subcommand "ordersub"')).to.equal(true);
      expect(has(findings, "duplicate-option", 'subcommand "dupsub"')).to.equal(true);
      expect(has(findings, "too-many-options", 'subcommand "bigsub"')).to.equal(true);
      expect(has(findings, "description-length", 'subcommand "descsub"')).to.equal(true);
      expect(findings).to.have.length(4);
    });
  });

  describe("-boundaries", () => {
    it("description of exactly 100 code points including emoji passes; 101 fails", () => {
      const ok = "\u{1F600}".repeat(99) + "a";
      expect(checkCommands([fixture("a.ts", { name: "a", description: ok })])).to.deep.equal([]);
      const findings = checkCommands([fixture("a.ts", { name: "a", description: ok + "b" })]);
      expect(has(findings, "description-length")).to.equal(true);
    });

    it("command name of 32 passes, 33 fails, and - _ ' are allowed", () => {
      expect(checkCommands([fixture("a.ts", { name: "a".repeat(32), description: "d" })])).to.deep.equal([]);
      expect(has(checkCommands([fixture("a.ts", { name: "a".repeat(33), description: "d" })]), "name-format")).to.equal(true);
      expect(checkCommands([fixture("a.ts", { name: "a-b_c'd", description: "d" })])).to.deep.equal([]);
    });
  });
});
