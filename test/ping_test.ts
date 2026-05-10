import { expect } from "chai";
import { execute } from "../commands/ping.js";
import type { ChatInputCommandInteraction } from "discord.js";

describe("#command: ping", () => {
  let mockReply = "";
  const mockInteraction = {
    reply: (content: string) => {
      mockReply = content;
    },
  } as unknown as ChatInputCommandInteraction;

  it('should return "Pong!"', async () => {
    try {
      await execute(mockInteraction);
    } catch (error) {
      console.error(error);
    }
    expect(mockReply).to.equal("Pong!");
  });
});
