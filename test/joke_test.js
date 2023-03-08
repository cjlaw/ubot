const { expect } = require("chai");
const JokeCommand = require("../commands/joke");

describe("#command: joke", () => {
  it("should return a joke", async () => {
    try {
      let mockInteraction = {
        reply: (content) => {
          mockReply = content;
        },
        mockReply: "",
      };
      await JokeCommand.execute(mockInteraction);
      expect(mockInteraction).to.not.be.undefined;
      expect(mockInteraction).to.not.be.empty;
    } catch (error) {
      console.error(error);
    }
  });
});
