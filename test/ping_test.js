import { expect } from "chai";
import { execute } from "../commands/ping.js";

describe("#command: ping", () => {
  let mockReply = "";
  let mockInteraction = {
    reply: (content) => {
      mockReply = content;
    },
  };
  it('should return "Pong!"', async () => {
    try {
      await execute(mockInteraction);
    } catch (error) {
      console.error(error);
    }
    expect(mockReply).to.equal("Pong!");
  });
});
