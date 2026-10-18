import { expect } from "chai";
import { join } from "node:path";
import { checkCommands, loadCommands } from "./support/command_rules.js";

describe("#guard: command registration", () => {
  it("every command in commands/ has a registrable definition and a handler", async () => {
    const entries = await loadCommands(join(import.meta.dirname, "..", "commands"));
    expect(entries.length, "no command files found; is the path wrong?").to.be.greaterThan(0);
    const findings = checkCommands(entries);
    expect(findings, `command definition problems:\n${findings.join("\n")}`).to.deep.equal([]);
  });
});
