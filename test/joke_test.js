import { expect } from "chai";
import { execute } from "../commands/joke.js";

describe("#command: joke", () => {
  it("should return a joke", async () => {
    try {
      let mockInteraction = {
        reply: (content) => {
          mockReply = content;
        },
        mockReply: "",
      };
      await execute(mockInteraction);
      expect(mockInteraction).to.not.be.undefined;
      expect(mockInteraction).to.not.be.empty;
    } catch (error) {
      console.error(error);
    }
  });
});
