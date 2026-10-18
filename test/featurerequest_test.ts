import { expect } from "chai";
import {
  COOLDOWN_MS,
  _getCooldownSize,
  _resetCooldowns,
  _setCooldown,
  handleModalSubmit,
} from "../commands/featurerequest.js";
import type { ModalSubmitInteraction } from "discord.js";

describe("#command: featurerequest", () => {
  const saved = process.env.FEATURE_REQUEST_CHANNEL_ID;

  beforeEach(() => {
    _resetCooldowns();
    process.env.FEATURE_REQUEST_CHANNEL_ID = "1";
  });

  afterEach(() => {
    _resetCooldowns();
    if (saved === undefined) delete process.env.FEATURE_REQUEST_CHANNEL_ID;
    else process.env.FEATURE_REQUEST_CHANNEL_ID = saved;
  });

  it("prunes expired cooldown entries when a new cooldown starts", async () => {
    _setCooldown("old", Date.now() - COOLDOWN_MS - 1000);
    _setCooldown("active", Date.now());
    const interaction = {
      user: { id: "new" },
      reply: async () => {},
      deferReply: async () => {},
      editReply: async () => {},
      fields: { getTextInputValue: () => "x" },
      client: { channels: { fetch: async () => ({ isSendable: () => true, send: async () => ({}) }) } },
    } as unknown as ModalSubmitInteraction;
    await handleModalSubmit(interaction);
    expect(_getCooldownSize()).to.equal(2);
  });
});
