import { expect } from "chai";
import { execute } from "../commands/joke.js";

const mockInteraction = () => {
  let reply = "";
  return {
    deferReply: async () => {},
    editReply: (content) => { reply = content; },
    getReply: () => reply,
  };
};

describe("#command: joke", () => {
  it("should return a joke", async () => {
    const interaction = mockInteraction();
    await execute(interaction);
    expect(interaction.getReply()).to.be.a("string");
    expect(interaction.getReply()).to.not.be.empty;
  });
});
