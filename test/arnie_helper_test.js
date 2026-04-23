import { expect } from "chai";
import { handleArnieMention } from "../helpers/arnie_helper.js";

const arnoldEmojiId = "894993017784643624";
const arnoldEmoji = {
  id: arnoldEmojiId,
  toString: () => `<:sbfvgsArnie:${arnoldEmojiId}>`,
};

describe("#reaction: arnie", () => {
  it('should respond to a mention of "arnie"', async () => {
    let message = {};
    message.content = "something something arnie";
    let result = handleArnieMention(message, arnoldEmoji);
    expect(result).to.not.be.undefined;
    expect(result.includes(arnoldEmoji.toString())).to.be.true;
  });

  it('should respond to a mention of "Arnie"', async () => {
    let message = {};
    message.content = "something something Arnie";
    let result = handleArnieMention(message, arnoldEmoji);
    expect(result).to.not.be.undefined;
    expect(result.includes(arnoldEmoji.toString())).to.be.true;
  });

  it('should respond to a mention of "arnold"', async () => {
    let message = {};
    message.content = "something something arnold";
    let result = handleArnieMention(message, arnoldEmoji);
    expect(result).to.not.be.undefined;
    expect(result.includes(arnoldEmoji.toString())).to.be.true;
  });

  it('should respond to a mention of "Arnold"', async () => {
    let message = {};
    message.content = "something something Arnold";
    let result = handleArnieMention(message, arnoldEmoji);
    expect(result).to.not.be.undefined;
    expect(result.includes(arnoldEmoji.toString())).to.be.true;
  });

  it("should respond without emoji if arnieEmoji is unavailable", async () => {
    let message = {};
    message.content = "something something arnie";
    let result = handleArnieMention(message, undefined);
    expect(result).to.not.be.undefined;
    expect(result).to.be.a("string");
    expect(result.includes("sbfvgsArnie")).to.be.false;
  });

  it('should not respond to a mention of "arney"', async () => {
    let message = {};
    message.content = "something something arney";
    let result = handleArnieMention(message, arnoldEmoji);
    expect(result).to.be.undefined;
  });

  it("should not respond to a use of arnie emoji", async () => {
    let message = {};
    message.content = `something something ${arnoldEmoji.toString()}`;
    let result = handleArnieMention(message, arnoldEmoji);
    expect(result).to.be.undefined;
  });
});
