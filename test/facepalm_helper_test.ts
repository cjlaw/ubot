import { expect } from "chai";
import { handleFacepalmMention } from "../helpers/facepalm_helper.js";
import type { Message } from "discord.js";

const message = {
  content: "",
  react: () => {},
} as unknown as Message;

describe("#reaction: trump", () => {
  it("should respond to a mention of a trump", async () => {
    (message as unknown as { content: string }).content = "something something trump";
    const result = handleFacepalmMention(message);
    expect(result).to.not.be.undefined;
    expect(result!.includes("burywite")).to.be.true;
  });

  it('should respond to a mention of "Trump"', async () => {
    (message as unknown as { content: string }).content = "something something Trump";
    const result = handleFacepalmMention(message);
    expect(result).to.not.be.undefined;
    expect(result!.includes("burywite")).to.be.true;
  });

  it('should not respond if "Trump" is not mentioned', async () => {
    (message as unknown as { content: string }).content = "something something";
    const result = handleFacepalmMention(message);
    expect(result).to.be.undefined;
  });
});
