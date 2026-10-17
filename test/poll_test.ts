import { expect } from "chai";
import { buildPollPayload } from "../helpers/poll_helper.js";

describe("#helper: poll", () => {
  describe("-buildPollPayload", () => {
    it("should throw when given more than 5 answers", () => {
      expect(() => buildPollPayload("Q", ["1", "2", "3", "4", "5", "6"], 24, false)).to.throw();
    });
  });
});
