import { expect } from "chai";
import { request } from "undici";
import { execute } from "../commands/xkcd.js";

let latestComic = 1941;

const mockInteraction = (selection) => {
  let reply = "";
  return {
    deferReply: async () => {},
    editReply: (content) => { reply = content; },
    getReply: () => reply,
    options: { getString: () => selection },
  };
};

describe("#command: xkcd", () => {
  before("get number of latest XKCD comic", async () => {
    const infoResult = await request("https://xkcd.com/info.0.json");
    const info = await infoResult.body.json();
    latestComic = info.num;
  });

  describe("-when getting a random comic", async () => {
    it("should return a valid comic", async () => {
      const interaction = mockInteraction("random");
      await execute(interaction);
      const reply = interaction.getReply();
      expect(reply.indexOf("#")).to.not.equal(-1);
      const comicNumber = parseInt(reply.substring(1, reply.indexOf(" ")));
      expect(comicNumber >= 1 && comicNumber <= latestComic).to.equal(true);
    });
  });

  describe("-when getting the latest comic", () => {
    it("should return a valid comic", async () => {
      const interaction = mockInteraction("latest");
      await execute(interaction);
      const reply = interaction.getReply();
      expect(reply.indexOf("#")).to.not.equal(-1);
      const comicNumber = parseInt(reply.substring(1, reply.indexOf(" ")));
      expect(comicNumber).to.equal(latestComic);
    });
  });

  describe("-when given invalid input", () => {
    it("should return a random comic", async () => {
      const interaction = mockInteraction("abc");
      await execute(interaction);
      const reply = interaction.getReply();
      expect(reply.indexOf("#")).to.not.equal(-1);
      const comicNumber = parseInt(reply.substring(1, reply.indexOf(" ")));
      expect(comicNumber >= 1 && comicNumber <= latestComic).to.equal(true);
    });
  });

  describe("-when getting comic #221", () => {
    it("should return a valid comic", async () => {
      const interaction = mockInteraction("221");
      await execute(interaction);
      const reply = interaction.getReply();
      expect(reply.indexOf("#")).to.not.equal(-1);
      const comicNumber = parseInt(reply.substring(1, reply.indexOf(" ")));
      expect(comicNumber).to.equal(221);
    });
  });
});
