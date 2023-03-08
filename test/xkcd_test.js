const { expect } = require("chai");
const { request } = require("undici");
const XkcdCommand = require("../commands/xkcd");
let latestComic = 1941;

describe("#command: xkcd", () => {
  before("get number of latest XKCD comic", async () => {
    let infoResult = await request("https://xkcd.com/info.0.json");
    let info = await infoResult.body.json();
    latestComic = info.num;
  });

  describe("-when getting a random comic", async () => {
    it("should return a valid comic", async () => {
      let mockReply = "";
      let mockInteraction = {
        reply: (content) => {
          mockReply = content;
        },
        options: {
          getString: (name) => {
            return "random";
          },
        },
      };
      try {
        await XkcdCommand.execute(mockInteraction);
      } catch (error) {
        console.error(error);
      }
      expect(mockReply).to.not.be.undefined;
      expect(mockReply.indexOf("#")).to.not.equal(-1);

      let comicNumber = mockReply.substring(1, mockReply.indexOf(" "));
      expect(comicNumber > 1 && comicNumber <= latestComic).to.equal(true);
    });
  });

  describe("-when getting the latest comic", () => {
    it("should return a valid comic", async () => {
      let mockReply = "";
      let mockInteraction = {
        reply: (content) => {
          mockReply = content;
        },
        options: {
          getString: (name) => {
            return "latest";
          },
        },
      };
      try {
        await XkcdCommand.execute(mockInteraction);
      } catch (error) {
        console.error(error);
      }
      expect(mockReply).to.not.be.undefined;
      expect(mockReply.indexOf("#")).to.not.equal(-1);

      let comicNumber = parseInt(
        mockReply.substring(1, mockReply.indexOf(" "))
      );
      expect(comicNumber).to.equal(latestComic);
    });
  });

  describe("-when getting comic #221", () => {
    it("should return a valid comic", async () => {
      let mockReply = "";
      let mockInteraction = {
        reply: (content) => {
          mockReply = content;
        },
        options: {
          getString: (name) => {
            return "221";
          },
        },
      };
      try {
        await XkcdCommand.execute(mockInteraction);
      } catch (error) {
        console.error(error);
      }
      expect(mockReply).to.not.be.undefined;
      expect(mockReply.indexOf("#")).to.not.equal(-1);

      let comicNumber = parseInt(
        mockReply.substring(1, mockReply.indexOf(" "))
      );
      expect(comicNumber).to.equal(221);
    });
  });
});
