const { expect } = require("chai");
const PingCommand = require("../commands/ping");

describe("#command: ping", () => {
  let mockReply = "";
  let mockInteraction = {
    reply: (content) => {
      mockReply = content;
    },
  };
  it('should return "Pong!"', async () => {
    try {
      await PingCommand.execute(mockInteraction);
    } catch (error) {
      console.error(error);
    }
    expect(mockReply).to.equal("Pong!");
  });
});
