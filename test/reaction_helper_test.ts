import { expect } from "chai";
import { handleUpvoteReaction, handleTwssReaction } from "../helpers/reaction_helper.js";
import type { MessageReaction, User } from "discord.js";

const reaction = {
  message: {
    content: "",
    author: {
      id: 1234,
    },
  },
} as unknown as MessageReaction;

const user = { id: 5678 } as unknown as User;

const emoji = "<:test_emoji:>";

describe("#reaction: upvote", () => {
  it("should return a message about which message was upvoted", () => {
    (reaction as unknown as { message: { content: string } }).message.content = "test message";
    const result = handleUpvoteReaction(reaction, user);
    expect(result).to.equal(
      `<@1234>++ received an upvote from <@5678> for "_test message_"`
    );
  });

  it("should return a message about which link was upvoted", () => {
    (reaction as unknown as { message: { content: string } }).message.content = "https://message.test";
    const result = handleUpvoteReaction(reaction, user);
    expect(result).to.equal(
      `<@1234>++ received an upvote from <@5678> for https://message.test`
    );
  });
});

describe("#reaction: twss", () => {
  it("should return a message about which message was twss-d", () => {
    (reaction as unknown as { message: { content: string } }).message.content = "test is too short";
    const result = handleTwssReaction(reaction, user);
    expect(result).to.equal(
      `<@5678> said ${(reaction as unknown as { emoji: string }).emoji} to "_test is too short_"`
    );
  });

  it("should return a message about which link was twss-d", () => {
    (reaction as unknown as { message: { content: string } }).message.content = "https://too.short.test";
    const result = handleTwssReaction(reaction, user);
    expect(result).to.equal(
      `<@5678> said ${(reaction as unknown as { emoji: string }).emoji} to https://too.short.test`
    );
  });
});
