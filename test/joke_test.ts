import { expect } from "chai";
import { execute } from "../commands/joke.js";
import type { ChatInputCommandInteraction } from "discord.js";

const mockInteraction = () => {
  let reply = "";
  return {
    deferReply: async () => {},
    editReply: (content: string) => { reply = content; },
    getReply: () => reply,
  };
};

describe("#command: joke", () => {
  it("should return a joke", async () => {
    const interaction = mockInteraction();
    await execute(interaction as unknown as ChatInputCommandInteraction);
    expect(interaction.getReply()).to.be.a("string");
    expect(interaction.getReply()).to.not.be.empty;
  });
});
