import { expect } from "chai";
import { handleArnieMention } from "../helpers/arnie_helper.js";
import type { Message, GuildEmoji } from "discord.js";

const arnoldEmojiId = "894993017784643624";
const arnoldEmoji = {
  id: arnoldEmojiId,
  toString: () => `<:sbfvgsArnie:${arnoldEmojiId}>`,
} as unknown as GuildEmoji;

describe("#reaction: arnie", () => {
  it('should respond to a mention of "arnie"', async () => {
    const message = { content: "something something arnie" } as unknown as Message;
    const result = handleArnieMention(message, arnoldEmoji);
    expect(result).to.not.be.undefined;
    expect(result!.includes(arnoldEmoji.toString())).to.be.true;
  });

  it('should respond to a mention of "Arnie"', async () => {
    const message = { content: "something something Arnie" } as unknown as Message;
    const result = handleArnieMention(message, arnoldEmoji);
    expect(result).to.not.be.undefined;
    expect(result!.includes(arnoldEmoji.toString())).to.be.true;
  });

  it('should respond to a mention of "arnold"', async () => {
    const message = { content: "something something arnold" } as unknown as Message;
    const result = handleArnieMention(message, arnoldEmoji);
    expect(result).to.not.be.undefined;
    expect(result!.includes(arnoldEmoji.toString())).to.be.true;
  });

  it('should respond to a mention of "Arnold"', async () => {
    const message = { content: "something something Arnold" } as unknown as Message;
    const result = handleArnieMention(message, arnoldEmoji);
    expect(result).to.not.be.undefined;
    expect(result!.includes(arnoldEmoji.toString())).to.be.true;
  });

  it("should respond without emoji if arnieEmoji is unavailable", async () => {
    const message = { content: "something something arnie" } as unknown as Message;
    const result = handleArnieMention(message, undefined);
    expect(result).to.not.be.undefined;
    expect(result).to.be.a("string");
    expect(result!.includes("sbfvgsArnie")).to.be.false;
  });

  it('should not respond to a mention of "arney"', async () => {
    const message = { content: "something something arney" } as unknown as Message;
    const result = handleArnieMention(message, arnoldEmoji);
    expect(result).to.be.undefined;
  });

  it("should not respond to a use of arnie emoji", async () => {
    const message = { content: `something something ${arnoldEmoji.toString()}` } as unknown as Message;
    const result = handleArnieMention(message, arnoldEmoji);
    expect(result).to.be.undefined;
  });
});
