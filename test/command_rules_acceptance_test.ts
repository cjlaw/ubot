import { expect } from "chai";
import { mkdtemp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
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

const cmd = (name: string, extra: Json = {}): Json => ({
  name,
  description: "A valid description",
  ...extra,
});

const opt = (name: string, extra: Json = {}): Json => ({
  type: 3,
  name,
  description: "An option",
  ...extra,
});

const sub = (name: string, options: Json[] = [], extra: Json = {}): Json => ({
  type: 1,
  name,
  description: "A subcommand",
  options,
  ...extra,
});

const group = (name: string, options: Json[]): Json => ({
  type: 2,
  name,
  description: "A group",
  options,
});

const choice = (name: string, value: string = name): Json => ({ name, value });

const many = <T>(n: number, make: (i: number) => T): T[] =>
  Array.from({ length: n }, (_, i) => make(i));

const check = (json: Json, file = "fixture.ts"): string[] => checkCommands([fixture(file, json)]);

const expectFinding = (findings: string[], command: string, rule: string) => {
  const match = findings.some((f) => f.includes(command) && f.includes(rule));
  expect(match, `expected a finding naming "${command}" and "${rule}", got ${JSON.stringify(findings)}`).to.equal(true);
};

const expectNoRule = (findings: string[], rule: string) => {
  const match = findings.filter((f) => f.includes(rule));
  expect(match, `expected no "${rule}" finding, got ${JSON.stringify(findings)}`).to.deep.equal([]);
};

describe("#helper: command_rules (acceptance)", () => {
  describe("-baseline", () => {
    it("baseline: a fully valid command (subcommands, groups, choices, required-before-optional) yields []", () => {
      const json = cmd("valid", {
        options: [
          sub("alpha", [
            opt("first", { required: true }),
            opt("second", { choices: [choice("one"), choice("two")] }),
          ]),
          group("beta", [
            sub("gamma", [opt("first", { required: true }), opt("second")]),
          ]),
        ],
      });
      expect(check(json)).to.deep.equal([]);
    });

    it("baseline: a valid command with plain top-level options yields []", () => {
      const json = cmd("plain", {
        options: [
          opt("question", { required: true }),
          opt("answer", { required: true }),
          { type: 4, name: "duration", description: "Hours" },
          { type: 5, name: "multi", description: "Multi" },
        ],
      });
      expect(check(json)).to.deep.equal([]);
    });

    it("baseline: an empty entry list yields []", () => {
      expect(checkCommands([])).to.deep.equal([]);
    });
  });

  describe("-criterion 1: missing command definition", () => {
    it("criterion 1: module with no data export fails missing-definition naming the file basename", () => {
      const findings = checkCommands([{ file: "nodef.ts", module: { execute: async () => {} } }]);
      expectFinding(findings, "nodef", "missing-definition");
    });

    it("criterion 1: data whose toJSON is not a function fails missing-definition naming the file basename", () => {
      const findings = checkCommands([
        { file: "badjson.ts", module: { data: { name: "badjson", toJSON: "nope" }, execute: async () => {} } },
      ]);
      expectFinding(findings, "badjson", "missing-definition");
    });

    it("criterion 1: findings name the command by file basename without the .ts extension", () => {
      const findings = checkCommands([{ file: "nodef.ts", module: { execute: async () => {} } }]);
      expect(findings).to.have.length.greaterThan(0);
      expect(findings.some((f) => f.includes("nodef.ts"))).to.equal(false);
    });
  });

  describe("-criterion 2: missing handler", () => {
    it("criterion 2: module with no execute export fails missing-handler naming data.name", () => {
      const findings = checkCommands([
        { file: "somefile.ts", module: { data: { toJSON: () => cmd("handlerless") } } },
      ]);
      expectFinding(findings, "handlerless", "missing-handler");
    });

    it("criterion 2: execute that is not a function fails missing-handler", () => {
      const findings = checkCommands([
        { file: "somefile.ts", module: { data: { toJSON: () => cmd("strexec") }, execute: "run" } },
      ]);
      expectFinding(findings, "strexec", "missing-handler");
    });

    it("criterion 1+2: module with neither data nor execute reports both rules, named by file basename", () => {
      const findings = checkCommands([{ file: "empty.ts", module: {} }]);
      expectFinding(findings, "empty", "missing-definition");
      expectFinding(findings, "empty", "missing-handler");
    });
  });

  describe("-edge: definition errors (import or toJSON throws)", () => {
    it("edge: an entry with loadError fails definition-error naming the file basename", () => {
      const findings = checkCommands([{ file: "broken.ts", loadError: new Error("boom on import") }]);
      expectFinding(findings, "broken", "definition-error");
    });

    it("edge: data.toJSON() throwing fails definition-error naming the file basename", () => {
      const findings = checkCommands([
        {
          file: "throwy.ts",
          module: { data: { toJSON: () => { throw new Error("bad def"); } }, execute: async () => {} },
        },
      ]);
      expectFinding(findings, "throwy", "definition-error");
    });

    it("edge: a real discord.js builder rejecting a violation becomes a definition-error naming the file, not a crash", () => {
      const findings = checkCommands([
        {
          file: "builderbad.ts",
          module: {
            data: {
              toJSON: () => new SlashCommandBuilder().setName("builderbad").setDescription("y".repeat(101)).toJSON(),
            },
            execute: async () => {},
          },
        },
      ]);
      expectFinding(findings, "builderbad", "definition-error");
    });

    it("edge: checkCommands never throws on malformed entries", () => {
      const entries = [
        { file: "a.ts" },
        { file: "b.ts", module: null },
        { file: "c.ts", module: 42 },
        { file: "d.ts", module: { data: null, execute: null } },
        { file: "e.ts", module: { data: { toJSON: () => null }, execute: async () => {} } },
        { file: "f.ts", module: { data: { toJSON: () => ({ name: 7 }) }, execute: async () => {} } },
        { file: "g.ts", loadError: "not even an Error" },
      ] as CommandEntry[];
      expect(() => checkCommands(entries)).to.not.throw();
    });

    it("edge: toJSON yielding a non-string name falls back to the file basename", () => {
      const findings = checkCommands([
        { file: "numname.ts", module: { data: { toJSON: () => ({ name: 7, description: "x" }) } } },
      ]);
      expectFinding(findings, "numname", "missing-handler");
    });
  });

  describe("-criterion 3a: command name format", () => {
    it("criterion 3a: an empty command name fails name-format", () => {
      const findings = check(cmd(""), "emptyname.ts");
      expect(findings.some((f) => f.includes("name-format"))).to.equal(true);
    });

    it("criterion 3a: a 33-character command name fails name-format naming the command", () => {
      const name = "a".repeat(33);
      expectFinding(check(cmd(name)), name, "name-format");
    });

    it("criterion 3a: a 32-character command name passes", () => {
      expect(check(cmd("a".repeat(32)))).to.deep.equal([]);
    });

    it("criterion 3a: a 1-character command name passes", () => {
      expect(check(cmd("a"))).to.deep.equal([]);
    });

    it("criterion 3a: an uppercase command name fails name-format", () => {
      expectFinding(check(cmd("Poll")), "Poll", "name-format");
    });

    it("criterion 3a: a command name with a space fails name-format", () => {
      expectFinding(check(cmd("find episode")), "find episode", "name-format");
    });

    it("criterion 3a: a command name with a disallowed character fails name-format", () => {
      expectFinding(check(cmd("poll!")), "poll!", "name-format");
    });

    it("criterion 3a: allowed punctuation, digits, and lowercase unicode letters pass", () => {
      expect(check(cmd("find-ep_2'x"))).to.deep.equal([]);
      expect(check(cmd("café"))).to.deep.equal([]);
    });

    it("criterion 3a: command name length is counted in code points", () => {
      const name = "é".repeat(32);
      expect(check(cmd(name))).to.deep.equal([]);
      expectFinding(check(cmd("é".repeat(33))), "é".repeat(33), "name-format");
    });

    it("criterion 3a: option names are not subject to name-format", () => {
      const findings = check(cmd("optname", { options: [opt("Upper")] }));
      expectNoRule(findings, "name-format");
    });
  });

  describe("-criterion 3b: description length", () => {
    it("criterion 3b: an empty command description fails description-length", () => {
      expectFinding(check(cmd("emptydesc", { description: "" })), "emptydesc", "description-length");
    });

    it("criterion 3b: a 101-character command description fails description-length", () => {
      expectFinding(check(cmd("longdesc", { description: "x".repeat(101) })), "longdesc", "description-length");
    });

    it("criterion 3b: a 100-character command description passes", () => {
      expect(check(cmd("okdesc", { description: "x".repeat(100) }))).to.deep.equal([]);
    });

    it("criterion 3b: an empty option description fails description-length", () => {
      const findings = check(cmd("optdesc", { options: [opt("q", { description: "" })] }));
      expectFinding(findings, "optdesc", "description-length");
    });

    it("criterion 3b: a 101-character option description fails description-length", () => {
      const findings = check(cmd("optlong", { options: [opt("q", { description: "x".repeat(101) })] }));
      expectFinding(findings, "optlong", "description-length");
    });

    it("criterion 3b: a 101-character subcommand description fails description-length", () => {
      const findings = check(cmd("sublong", { options: [sub("s", [], { description: "x".repeat(101) })] }));
      expectFinding(findings, "sublong", "description-length");
    });

    it("criterion 3b: a 101-character description on an option nested in a group's subcommand fails description-length", () => {
      const findings = check(cmd("deeplong", {
        options: [group("g", [sub("s", [opt("q", { description: "x".repeat(101) })])])],
      }));
      expectFinding(findings, "deeplong", "description-length");
    });

    it("criterion 3b: an empty choice name fails description-length", () => {
      const findings = check(cmd("choiceempty", { options: [opt("q", { choices: [choice("", "v")] })] }));
      expectFinding(findings, "choiceempty", "description-length");
    });

    it("criterion 3b: a 101-character choice name fails description-length", () => {
      const findings = check(cmd("choicelong", { options: [opt("q", { choices: [choice("x".repeat(101), "v")] })] }));
      expectFinding(findings, "choicelong", "description-length");
    });

    it("criterion 3b: a 100-character choice name passes", () => {
      expect(check(cmd("choiceok", { options: [opt("q", { choices: [choice("x".repeat(100), "v")] })] }))).to.deep.equal([]);
    });

    it("edge 3b: lengths are counted in code points, so 100 code points of flag-emoji text passes", () => {
      const flags = "\u{1F1FA}\u{1F1F8}".repeat(50);
      expect([...flags]).to.have.lengthOf(100);
      expect(flags.length).to.equal(200);
      expect(check(cmd("emoji", { description: flags }))).to.deep.equal([]);
    });

    it("edge 3b: 101 code points of emoji text fails description-length", () => {
      const desc = "\u{1F600}".repeat(101);
      expectFinding(check(cmd("emojilong", { description: desc })), "emojilong", "description-length");
    });
  });

  describe("-criterion 3c: option and choice counts", () => {
    it("criterion 3c: 26 top-level options fails too-many-options", () => {
      const findings = check(cmd("manyopts", { options: many(26, (i) => opt(`o${i}`)) }));
      expectFinding(findings, "manyopts", "too-many-options");
    });

    it("criterion 3c: 25 top-level options passes", () => {
      expect(check(cmd("okopts", { options: many(25, (i) => opt(`o${i}`)) }))).to.deep.equal([]);
    });

    it("criterion 3c: 26 subcommands at top level fails too-many-options", () => {
      const findings = check(cmd("manysubs", { options: many(26, (i) => sub(`s${i}`)) }));
      expectFinding(findings, "manysubs", "too-many-options");
    });

    it("criterion 3c: 26 options nested in a subcommand fails too-many-options", () => {
      const findings = check(cmd("nestedopts", { options: [sub("s", many(26, (i) => opt(`o${i}`)))] }));
      expectFinding(findings, "nestedopts", "too-many-options");
    });

    it("criterion 3c: 26 options in a subcommand inside a group fails too-many-options", () => {
      const findings = check(cmd("deepopts", {
        options: [group("g", [sub("s", many(26, (i) => opt(`o${i}`)))])],
      }));
      expectFinding(findings, "deepopts", "too-many-options");
    });

    it("criterion 3c: 26 subcommands inside a group fails too-many-options", () => {
      const findings = check(cmd("groupsubs", { options: [group("g", many(26, (i) => sub(`s${i}`)))] }));
      expectFinding(findings, "groupsubs", "too-many-options");
    });

    it("criterion 3c: 26 choices on an option fails too-many-choices", () => {
      const findings = check(cmd("manychoices", { options: [opt("q", { choices: many(26, (i) => choice(`c${i}`)) })] }));
      expectFinding(findings, "manychoices", "too-many-choices");
    });

    it("criterion 3c: 25 choices on an option passes", () => {
      expect(check(cmd("okchoices", { options: [opt("q", { choices: many(25, (i) => choice(`c${i}`)) })] }))).to.deep.equal([]);
    });

    it("criterion 3c: 26 choices on an option nested in a subcommand fails too-many-choices", () => {
      const findings = check(cmd("nestedchoices", {
        options: [sub("s", [opt("q", { choices: many(26, (i) => choice(`c${i}`)) })])],
      }));
      expectFinding(findings, "nestedchoices", "too-many-choices");
    });
  });

  describe("-criterion 3d: required option order", () => {
    it("criterion 3d: a required option after an optional one fails required-order", () => {
      const findings = check(cmd("badorder", { options: [opt("a"), opt("b", { required: true })] }));
      expectFinding(findings, "badorder", "required-order");
    });

    it("criterion 3d: required: false counts as optional", () => {
      const findings = check(cmd("falseorder", { options: [opt("a", { required: false }), opt("b", { required: true })] }));
      expectFinding(findings, "falseorder", "required-order");
    });

    it("criterion 3d: required options before optional ones pass", () => {
      const json = cmd("goodorder", { options: [opt("a", { required: true }), opt("b", { required: true }), opt("c"), opt("d")] });
      expect(check(json)).to.deep.equal([]);
    });

    it("criterion 3d: required-after-optional inside a subcommand fails required-order", () => {
      const findings = check(cmd("suborder", {
        options: [sub("s", [opt("a"), opt("b", { required: true })])],
      }));
      expectFinding(findings, "suborder", "required-order");
    });

    it("criterion 3d: required-after-optional inside a group's subcommand fails required-order", () => {
      const findings = check(cmd("grouporder", {
        options: [group("g", [sub("s", [opt("a"), opt("b", { required: true })])])],
      }));
      expectFinding(findings, "grouporder", "required-order");
    });

    it("criterion 3d: order is per level — an optional option in one subcommand does not affect a required one in another", () => {
      const json = cmd("perlevel", {
        options: [sub("s1", [opt("a")]), sub("s2", [opt("b", { required: true })])],
      });
      expect(check(json)).to.deep.equal([]);
    });

    it("criterion 3d: subcommand and group entries (types 1 and 2) are ignored for required-order", () => {
      const json = cmd("subflags", {
        options: [sub("s1"), sub("s2", [], { required: true }), group("g", [sub("s3"), sub("s4", [], { required: true })])],
      });
      expectNoRule(check(json), "required-order");
    });
  });

  describe("-criterion 3e: duplicate option names", () => {
    it("criterion 3e: two top-level options sharing a name fail duplicate-option", () => {
      const findings = check(cmd("dupopt", { options: [opt("q"), opt("q")] }));
      expectFinding(findings, "dupopt", "duplicate-option");
    });

    it("criterion 3e: two subcommands sharing a name fail duplicate-option", () => {
      const findings = check(cmd("dupsub", { options: [sub("s"), sub("s")] }));
      expectFinding(findings, "dupsub", "duplicate-option");
    });

    it("criterion 3e: two options sharing a name inside a subcommand fail duplicate-option", () => {
      const findings = check(cmd("dupnested", { options: [sub("s", [opt("q"), opt("q")])] }));
      expectFinding(findings, "dupnested", "duplicate-option");
    });

    it("criterion 3e: the same option name at different levels passes", () => {
      const json = cmd("difflevels", {
        options: [sub("s1", [opt("text")]), sub("s2", [opt("text")])],
      });
      expect(check(json)).to.deep.equal([]);
    });
  });

  describe("-criterion 4: duplicate command names", () => {
    it("criterion 4: two entries resolving to the same command name fail duplicate-command naming the command", () => {
      const findings = checkCommands([fixture("one.ts", cmd("same")), fixture("two.ts", cmd("same"))]);
      expectFinding(findings, "same", "duplicate-command");
    });

    it("criterion 4: distinct command names do not produce duplicate-command", () => {
      const findings = checkCommands([fixture("one.ts", cmd("first")), fixture("two.ts", cmd("second"))]);
      expect(findings).to.deep.equal([]);
    });
  });

  describe("-criterion 5: commands are discovered, not hand-listed", () => {
    let dir: string;

    before(async () => {
      dir = await mkdtemp(join(tmpdir(), "ubot-cmdrules-"));
      await writeFile(join(dir, "package.json"), JSON.stringify({ type: "module" }));
      await writeFile(
        join(dir, "b_unlisted.ts"),
        [
          "export const data = { toJSON: () => ({ name: \"unlisted\", description: \"ok\", options: [",
          "  { type: 3, name: \"a\", description: \"a\" },",
          "  { type: 3, name: \"b\", description: \"b\", required: true },",
          "] }) };",
          "export async function execute(): Promise<void> {}",
          "",
        ].join("\n"),
      );
      await writeFile(
        join(dir, "a_valid.ts"),
        [
          "export const data = { toJSON: () => ({ name: \"valid\", description: \"ok\" }) };",
          "export async function execute(): Promise<void> {}",
          "",
        ].join("\n"),
      );
      await writeFile(join(dir, "c_throws.ts"), "throw new Error(\"import failure\");\nexport {};\n");
      await writeFile(join(dir, "types.d.ts"), "export declare const x: number;\n");
      await writeFile(join(dir, "notes.js"), "export const data = 1;\n");
      await mkdir(join(dir, "nested"));
      await writeFile(
        join(dir, "nested", "deep.ts"),
        "export const data = { toJSON: () => ({ name: \"deep\", description: \"ok\" }) };\nexport async function execute(): Promise<void> {}\n",
      );
    });

    after(async () => {
      await rm(dir, { recursive: true, force: true });
    });

    it("criterion 5: loadCommands loads every top-level .ts file sorted by name, skipping .d.ts, non-.ts, and subdirectories", async () => {
      const entries = await loadCommands(dir);
      expect(entries.map((e) => e.file)).to.deep.equal(["a_valid.ts", "b_unlisted.ts", "c_throws.ts"]);
    });

    it("criterion 5: a file that throws on import is captured as loadError rather than rejecting", async () => {
      const entries = await loadCommands(dir);
      const thrown = entries.find((e) => e.file === "c_throws.ts");
      expect(thrown).to.not.equal(undefined);
      expect(thrown!.loadError).to.not.equal(undefined);
    });

    it("criterion 5: a command with no dedicated test is still checked — its violation is reported", async () => {
      const findings = checkCommands(await loadCommands(dir));
      expectFinding(findings, "unlisted", "required-order");
      expectFinding(findings, "c_throws", "definition-error");
      expect(findings.some((f) => f.includes("valid:") || f.startsWith("valid"))).to.equal(false);
    });

    it("criterion 5: loadCommands on the real commands/ dir loads exactly the top-level .ts files there", async () => {
      const commandsDir = join(import.meta.dirname, "..", "commands");
      const expected = (await readdir(commandsDir, { withFileTypes: true }))
        .filter((d) => d.isFile() && d.name.endsWith(".ts") && !d.name.endsWith(".d.ts"))
        .map((d) => d.name)
        .sort();
      const entries = await loadCommands(commandsDir);
      expect(entries.map((e) => e.file)).to.deep.equal(expected);
    });
  });

  describe("-criterion 6: current commands pass", () => {
    it("criterion 6: every command in commands/ loads and checkCommands reports no findings", async () => {
      const entries = await loadCommands(join(import.meta.dirname, "..", "commands"));
      expect(entries).to.have.length.greaterThan(0);
      for (const e of entries) {
        expect(e.loadError, `${e.file} failed to load`).to.equal(undefined);
      }
      expect(checkCommands(entries)).to.deep.equal([]);
    });
  });

  describe("-criterion 7: no network, no credentials", () => {
    const credentialKeys = ["bot_token", "clientId", "guildId", "ANTHROPIC_API_KEY"];
    const savedEnv: Record<string, string | undefined> = {};
    const realFetch = globalThis.fetch;
    let fetchCalls = 0;

    before(() => {
      for (const key of credentialKeys) {
        savedEnv[key] = process.env[key];
        delete process.env[key];
      }
      globalThis.fetch = async () => {
        fetchCalls++;
        throw new Error("network access is not allowed in the command check");
      };
    });

    after(() => {
      globalThis.fetch = realFetch;
      for (const key of credentialKeys) {
        if (savedEnv[key] === undefined) delete process.env[key];
        else process.env[key] = savedEnv[key];
      }
    });

    it("criterion 7: the real-command check passes with credentials unset and makes no fetch calls", async () => {
      const findings = checkCommands(await loadCommands(join(import.meta.dirname, "..", "commands")));
      expect(findings).to.deep.equal([]);
      expect(fetchCalls).to.equal(0);
    });
  });
});
