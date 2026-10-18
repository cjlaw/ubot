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
  const realFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("should reply with the joke from the service", async () => {
    globalThis.fetch = async () => new Response("Why did the chicken cross the road?");
    const interaction = mockInteraction();
    await execute(interaction as unknown as ChatInputCommandInteraction);
    expect(interaction.getReply()).to.equal("Why did the chicken cross the road?");
  });

  it("should reply with an apology when the service is unreachable", async () => {
    globalThis.fetch = async () => { throw new Error("offline"); };
    const interaction = mockInteraction();
    await execute(interaction as unknown as ChatInputCommandInteraction);
    expect(interaction.getReply()).to.contain("couldn't fetch a joke");
  });
});
