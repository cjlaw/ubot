import { expect } from "chai";
import { ArnieHelper } from "../helpers/arnie_helper.js";

const arnoldEmojiId = "894993017784643624";
const arnoldEmoji = `<:sbfvgsArnie:${arnoldEmojiId}>`;

describe("#reaction: arnie", () => {
  it('should respond to a mention of "arnie"', async () => {
    let message = {};
    message.content = "something something arnie";
    let result = ArnieHelper.handleArnieMention(message);
    expect(result).to.not.be.undefined;
    expect(result.includes(arnoldEmoji)).to.be.true;
  });

  it('should respond to a mention of "Arnie"', async () => {
    let message = {};
    message.content = "something something Arnie";
    let result = ArnieHelper.handleArnieMention(message);
    expect(result).to.not.be.undefined;
    expect(result.includes(arnoldEmoji)).to.be.true;
  });

  it('should respond to a mention of "arnold"', async () => {
    let message = {};
    message.content = "something something arnold";
    let result = ArnieHelper.handleArnieMention(message);
    expect(result).to.not.be.undefined;
    expect(result.includes(arnoldEmoji)).to.be.true;
  });

  it('should respond to a mention of "Arnold"', async () => {
    let message = {};
    message.content = "something something Arnold";
    let result = ArnieHelper.handleArnieMention(message);
    expect(result).to.not.be.undefined;
    expect(result.includes(arnoldEmoji)).to.be.true;
  });

  it('should not respond to a mention of "arney"', async () => {
    let message = {};
    message.content = "something something arney";
    let result = ArnieHelper.handleArnieMention(message);
    expect(result).to.be.undefined;
  });

  it("should not respond to a use of arnie emoji", async () => {
    let message = {};
    message.content = `something something ${arnoldEmoji}`;
    let result = ArnieHelper.handleArnieMention(message);
    expect(result).to.be.undefined;
  });
});
