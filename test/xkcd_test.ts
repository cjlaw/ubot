import { expect } from "chai";
import { execute } from "../commands/xkcd.js";
import type { ChatInputCommandInteraction } from "discord.js";

const latestComic = 1941;

const mockInteraction = (selection: string | null) => {
  let reply = "";
  return {
    deferReply: async () => {},
    editReply: (content: string) => { reply = content; },
    getReply: () => reply,
    options: { getString: () => selection },
  };
};

// Serves a fake xkcd archive so the tests need no network.
const fakeXkcd = async (input: string | URL | Request): Promise<Response> => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const match = /^https:\/\/xkcd\.com\/(?:(\d+)\/)?info\.0\.json$/.exec(url);
  if (!match) throw new Error(`unexpected fetch: ${url}`);
  const num = match[1] ? parseInt(match[1], 10) : latestComic;
  return new Response(JSON.stringify({ num, title: `Comic ${num}`, img: `https://imgs.xkcd.com/${num}.png`, alt: "alt text" }));
};

describe("#command: xkcd", () => {
  const realFetch = globalThis.fetch;

  before(() => {
    globalThis.fetch = fakeXkcd;
  });

  after(() => {
    globalThis.fetch = realFetch;
  });

  describe("-when getting a random comic", () => {
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

  describe("-when the comic service is unreachable", () => {
    it("should reply with an apology instead of throwing", async () => {
      globalThis.fetch = async () => { throw new Error("offline"); };
      try {
        const interaction = mockInteraction("latest");
        await execute(interaction as unknown as ChatInputCommandInteraction);
        expect(interaction.getReply()).to.contain("couldn't fetch a comic");
      } finally {
        globalThis.fetch = fakeXkcd;
      }
    });
  });
});
