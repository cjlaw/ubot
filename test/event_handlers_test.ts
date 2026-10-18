import { expect } from "chai";
import type { MessageReaction, User } from "discord.js";
import { formatError } from "../helpers/error_helper.js";
import { handleReaction } from "../helpers/event_handlers.js";

describe("formatError", () => {
  it("returns the stack for an Error", () => {
    const err = new Error("boom");
    expect(formatError(err)).to.equal(err.stack);
  });

  it("falls back to the message when there is no stack", () => {
    const err = new Error("boom");
    err.stack = undefined;
    expect(formatError(err)).to.equal("boom");
  });

  it("stringifies non-Errors", () => {
    expect(formatError("nope")).to.equal("nope");
    expect(formatError(42)).to.equal("42");
  });
});

describe("handleReaction edge cases", () => {
  const originalError = console.error;
  let errors: unknown[][];
  beforeEach(() => {
    errors = [];
    console.error = (...args: unknown[]) => { errors.push(args); };
  });
  afterEach(() => {
    console.error = originalError;
  });

  const user = { id: "1" } as unknown as User;

  it("logs a formatted error and does not send when the partial fetch fails", async () => {
    let sent = 0;
    const reaction = {
      partial: true,
      fetch: () => Promise.reject(new Error("fetch failed")),
      emoji: { name: "upvote" },
      message: { channel: { send: () => { sent++; return Promise.resolve(); } } },
    } as unknown as MessageReaction;
    await handleReaction(reaction, user);
    expect(sent).to.equal(0);
    expect(errors).to.have.lengthOf(1);
    expect(errors[0].every((arg) => typeof arg === "string")).to.equal(true);
    expect(errors[0].join(" ")).to.include("fetch failed");
  });

  it("is a no-op when the channel cannot send", async () => {
    const reaction = {
      partial: false,
      emoji: { name: "upvote" },
      message: { channel: {} },
    } as unknown as MessageReaction;
    await handleReaction(reaction, user);
    expect(errors).to.have.lengthOf(0);
  });
});
