import { expect } from "chai";
import { FacepalmHelper } from "../helpers/facepalm_helper.js";

let message = {};
message.content = "";
message.react = () => {};

describe("#reaction: trump", () => {
  it("should respond to a mention of a trump", async () => {
    message.content = "something something trump";
    let result = FacepalmHelper.handleFacepalmMention(message);
    expect(result).to.not.be.undefined;
    expect(result.includes("burywite")).to.be.true;
  });

  it('should respond to a mention of "Trump"', async () => {
    message.content = "something something Trump";
    let result = FacepalmHelper.handleFacepalmMention(message);
    expect(result).to.not.be.undefined;
    expect(result.includes("burywite")).to.be.true;
  });

  it('should not respond if "Trump" is not mentioned', async () => {
    message.content = "something something";
    let result = FacepalmHelper.handleFacepalmMention(message);
    expect(result).to.be.undefined;
  });
});
