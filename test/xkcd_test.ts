import { expect } from "chai";
import { execute } from "../commands/xkcd.js";
import type { ChatInputCommandInteraction } from "discord.js";

let latestComic = 1941;

const mockInteraction = (selection: string | null) => {
  let reply = "";
  return {
    deferReply: async () => {},
    editReply: (content: string) => { reply = content; },
    getReply: () => reply,
    options: { getString: () => selection },
  };
};

describe("#command: xkcd", () => {
  before("get number of latest XKCD comic", async () => {
    const info = await fetch("https://xkcd.com/info.0.json").then((r) => r.json()) as { num: number };
    latestComic = info.num;
  });

  describe("-when getting a random comic", async () => {
    it("should return a valid comic", async () => {
      const interaction = mockInteraction("random");
      await execute(interaction as unknown as ChatInputCommandInteraction);
      const reply = interaction.getReply();
      expect(reply.indexOf("#")).to.not.equal(-1);
      const comicNumber = parseInt(reply.substring(1, reply.indexOf(" ")));
      expect(comicNumber >= 1 && comicNumber <= latestComic).to.equal(true);
    });
  });

  describe("-when getting the latest comic", () => {
    it("should return a valid comic", async () => {
      const interaction = mockInteraction("latest");
      await execute(interaction as unknown as ChatInputCommandInteraction);
      const reply = interaction.getReply();
      expect(reply.indexOf("#")).to.not.equal(-1);
      const comicNumber = parseInt(reply.substring(1, reply.indexOf(" ")));
      expect(comicNumber).to.equal(latestComic);
    });
  });

  describe("-when given invalid input", () => {
    it("should return a random comic", async () => {
      const interaction = mockInteraction("abc");
      await execute(interaction as unknown as ChatInputCommandInteraction);
      const reply = interaction.getReply();
      expect(reply.indexOf("#")).to.not.equal(-1);
      const comicNumber = parseInt(reply.substring(1, reply.indexOf(" ")));
      expect(comicNumber >= 1 && comicNumber <= latestComic).to.equal(true);
    });
  });

  describe("-when getting comic #221", () => {
    it("should return a valid comic", async () => {
      const interaction = mockInteraction("221");
      await execute(interaction as unknown as ChatInputCommandInteraction);
      const reply = interaction.getReply();
      expect(reply.indexOf("#")).to.not.equal(-1);
      const comicNumber = parseInt(reply.substring(1, reply.indexOf(" ")));
      expect(comicNumber).to.equal(221);
    });
  });
});
