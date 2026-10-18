import { expect } from "chai";
import { inspect } from "node:util";
import { InteractionContextType, MessageFlags } from "discord.js";
import type { ChatInputCommandInteraction, ModalSubmitInteraction } from "discord.js";
import {
  data,
  execute,
  handleModalSubmit,
  TITLE_MAX,
  DESCRIPTION_MAX,
  COOLDOWN_MS,
  MODAL_ID,
  _resetCooldowns,
  _setCooldown,
} from "../commands/featurerequest.js";

const CHANNEL_ID = "222333444555666777";
const MAINTAINER_ID = "888999000111222333";
const SUBMITTER_ID = "123456789012345678";
const OTHER_USER_ID = "765432109876543210";

type Payload = Record<string, any>;

const toJSON = (value: unknown): any => {
  const candidate = value as { toJSON?: () => unknown } | null | undefined;
  return candidate && typeof candidate.toJSON === "function" ? candidate.toJSON() : value;
};

const contentOf = (payload: unknown): string => {
  if (typeof payload === "string") return payload;
  const content = (payload as Payload | undefined)?.content;
  return typeof content === "string" ? content : "";
};

const isEphemeral = (payload: unknown): boolean => {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Payload;
  if (p.ephemeral === true) return true;
  return typeof p.flags === "number" && (p.flags & Number(MessageFlags.Ephemeral)) !== 0;
};

const normalizeApostrophes = (text: string): string => text.replace(/\u2019/g, "'");

const relTimestamp = (lastMs: number): string =>
  `<t:${Math.floor((lastMs + COOLDOWN_MS) / 1000)}:R>`;

const makeUser = (id: string) => ({ id, username: `user${id}`, toString: () => `<@${id}>` });

const makeCommandInteraction = (opts: { userId?: string; inGuild?: boolean; admin?: boolean } = {}) => {
  const replies: unknown[] = [];
  const modals: unknown[] = [];
  const deferReplies: unknown[] = [];
  const editReplies: unknown[] = [];
  const userId = opts.userId ?? SUBMITTER_ID;
  const inGuild = opts.inGuild ?? true;
  const interaction = {
    commandName: "featurerequest",
    user: makeUser(userId),
    guildId: inGuild ? "999000999000999000" : null,
    memberPermissions: inGuild ? { has: () => opts.admin ?? false } : null,
    replied: false,
    deferred: false,
    inGuild: () => inGuild,
    isChatInputCommand: () => true,
    isModalSubmit: () => false,
    reply: async (payload: unknown) => { replies.push(payload); interaction.replied = true; },
    deferReply: async (payload: unknown) => { deferReplies.push(payload); interaction.deferred = true; },
    editReply: async (payload: unknown) => { editReplies.push(payload); },
    showModal: async (modal: unknown) => { modals.push(modal); },
  };
  return {
    interaction: interaction as unknown as ChatInputCommandInteraction,
    replies,
    modals,
    deferReplies,
    editReplies,
  };
};

type ChannelMode = "ok" | "fetchRejects" | "fetchNull" | "noSend" | "sendRejects";

const makeSubmitInteraction = (opts: {
  userId?: string;
  title?: string;
  description?: string;
  channel?: ChannelMode;
} = {}) => {
  const replies: unknown[] = [];
  const deferReplies: unknown[] = [];
  const editReplies: unknown[] = [];
  const followUps: unknown[] = [];
  const sends: unknown[] = [];
  const fetchedIds: unknown[] = [];
  const userId = opts.userId ?? SUBMITTER_ID;
  const fields: Record<string, string> = {
    title: opts.title ?? "Add a /weather command",
    description: opts.description ?? "It would be nice to check the weather from Discord.",
  };
  const mode = opts.channel ?? "ok";

  const sendableChannel = {
    id: CHANNEL_ID,
    isTextBased: () => true,
    isSendable: () => true,
    send: async (payload: unknown) => {
      sends.push(payload);
      if (mode === "sendRejects") {
        throw Object.assign(new Error("Missing Permissions"), { code: 50013 });
      }
      return { id: "555555555555555555", url: `https://discord.com/channels/1/${CHANNEL_ID}/555555555555555555` };
    },
  };
  const unsendableChannel = {
    id: CHANNEL_ID,
    isTextBased: () => false,
    isSendable: () => false,
  };

  const interaction = {
    customId: MODAL_ID,
    user: makeUser(userId),
    guildId: "999000999000999000",
    replied: false,
    deferred: false,
    inGuild: () => true,
    isModalSubmit: () => true,
    isChatInputCommand: () => false,
    fields: {
      getTextInputValue: (id: string) => {
        if (!(id in fields)) throw new Error(`unknown field ${id}`);
        return fields[id];
      },
    },
    client: {
      channels: {
        fetch: async (id: unknown) => {
          fetchedIds.push(id);
          if (mode === "fetchRejects") throw Object.assign(new Error("Unknown Channel"), { code: 10003 });
          if (mode === "fetchNull") return null;
          if (mode === "noSend") return unsendableChannel;
          return sendableChannel;
        },
      },
    },
    reply: async (payload: unknown) => { replies.push(payload); interaction.replied = true; },
    deferReply: async (payload: unknown) => { deferReplies.push(payload); interaction.deferred = true; },
    editReply: async (payload: unknown) => { editReplies.push(payload); },
    followUp: async (payload: unknown) => { followUps.push(payload); },
  };
  return {
    interaction: interaction as unknown as ModalSubmitInteraction,
    replies,
    deferReplies,
    editReplies,
    followUps,
    sends,
    fetchedIds,
  };
};

const runSubmit = async (opts: Parameters<typeof makeSubmitInteraction>[0] = {}) => {
  const ctx = makeSubmitInteraction(opts);
  await handleModalSubmit(ctx.interaction);
  return ctx;
};

const runExecute = async (opts: Parameters<typeof makeCommandInteraction>[0] = {}) => {
  const ctx = makeCommandInteraction(opts);
  await execute(ctx.interaction);
  return ctx;
};

const sentPayload = (sends: unknown[]): Payload => {
  expect(sends).to.have.lengthOf(1);
  return sends[0] as Payload;
};

const sentEmbed = (payload: Payload): Payload => {
  expect(payload.embeds).to.be.an("array").with.lengthOf(1);
  return toJSON(payload.embeds[0]) as Payload;
};

const modalJSON = (modals: unknown[]): Payload => {
  expect(modals).to.have.lengthOf(1);
  return toJSON(modals[0]) as Payload;
};

const finalSubmitReply = (ctx: ReturnType<typeof makeSubmitInteraction>): unknown => {
  const all = [...ctx.editReplies, ...ctx.replies, ...ctx.followUps];
  expect(all.length).to.be.at.least(1);
  return all[all.length - 1];
};

const expectSubmitEphemeral = (ctx: ReturnType<typeof makeSubmitInteraction>) => {
  if (ctx.deferReplies.length > 0) {
    expect(isEphemeral(ctx.deferReplies[0])).to.equal(true);
  } else {
    expect(ctx.replies).to.have.lengthOf(1);
    expect(isEphemeral(ctx.replies[0])).to.equal(true);
  }
};

const expectCouldNotBeFiled = (ctx: ReturnType<typeof makeSubmitInteraction>) => {
  expectSubmitEphemeral(ctx);
  const text = normalizeApostrophes(contentOf(finalSubmitReply(ctx)).toLowerCase());
  expect(text).to.include("couldn't be filed");
};

const expectModalOpens = async (userId = SUBMITTER_ID) => {
  const ctx = await runExecute({ userId });
  expect(ctx.modals).to.have.lengthOf(1);
  expect(ctx.replies).to.deep.equal([]);
  return ctx;
};

const expectOnCooldownReply = (ctx: ReturnType<typeof makeCommandInteraction>) => {
  expect(ctx.modals).to.deep.equal([]);
  expect(ctx.replies).to.have.lengthOf(1);
  expect(isEphemeral(ctx.replies[0])).to.equal(true);
  return contentOf(ctx.replies[0]);
};

type Calls = unknown[][];
const logs: { error: Calls; warn: Calls; log: Calls } = { error: [], warn: [], log: [] };
const originalConsole = {
  error: console.error.bind(console),
  warn: console.warn.bind(console),
  log: console.log.bind(console),
};
const allLogText = (): string =>
  logs.error.concat(logs.warn, logs.log)
    .map((args) => args.map((a) => (typeof a === "string" ? a : inspect(a, { depth: null }))).join(" "))
    .join("\n");

describe("#command: featurerequest (acceptance)", () => {
  let savedChannel: string | undefined;
  let savedMaintainer: string | undefined;

  beforeEach(() => {
    savedChannel = process.env.FEATURE_REQUEST_CHANNEL_ID;
    savedMaintainer = process.env.FEATURE_REQUEST_MAINTAINER_ID;
    process.env.FEATURE_REQUEST_CHANNEL_ID = CHANNEL_ID;
    process.env.FEATURE_REQUEST_MAINTAINER_ID = MAINTAINER_ID;
    _resetCooldowns();
    logs.error = [];
    logs.warn = [];
    logs.log = [];
    console.error = (...args: unknown[]) => { logs.error.push(args); };
    console.warn = (...args: unknown[]) => { logs.warn.push(args); };
    console.log = (...args: unknown[]) => { logs.log.push(args); };
  });

  afterEach(() => {
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    console.log = originalConsole.log;
    if (savedChannel === undefined) delete process.env.FEATURE_REQUEST_CHANNEL_ID;
    else process.env.FEATURE_REQUEST_CHANNEL_ID = savedChannel;
    if (savedMaintainer === undefined) delete process.env.FEATURE_REQUEST_MAINTAINER_ID;
    else process.env.FEATURE_REQUEST_MAINTAINER_ID = savedMaintainer;
    _resetCooldowns();
  });

  describe("-exports", () => {
    it("exports the documented constants", () => {
      expect(TITLE_MAX).to.equal(100);
      expect(DESCRIPTION_MAX).to.equal(1000);
      expect(COOLDOWN_MS).to.equal(60 * 60 * 1000);
      expect(MODAL_ID).to.equal("featurerequest");
    });

    it("data is named featurerequest with a description", () => {
      const json = data.toJSON();
      expect(json.name).to.equal("featurerequest");
      expect(json.description).to.be.a("string").and.not.equal("");
    });
  });

  describe("-criterion 1: running the command opens the modal", () => {
    it("criterion 1: in a guild, execute calls showModal once and sends no reply", async () => {
      const ctx = await runExecute();
      expect(ctx.modals).to.have.lengthOf(1);
      expect(ctx.replies).to.deep.equal([]);
      expect(ctx.deferReplies).to.deep.equal([]);
      expect(ctx.editReplies).to.deep.equal([]);
    });

    it("criterion 1: modal has custom_id featurerequest and exactly two label components (Title, Description)", async () => {
      const modal = modalJSON((await runExecute()).modals);
      expect(modal.custom_id).to.equal("featurerequest");
      expect(modal.title).to.be.a("string").and.not.equal("");
      expect(modal.components).to.be.an("array").with.lengthOf(2);
      expect((modal.components as Payload[]).map((c) => c.type)).to.deep.equal([18, 18]);
      expect((modal.components as Payload[]).map((c) => c.label)).to.deep.equal(["Title", "Description"]);
    });

    it("criterion 1: Title is a required short text input with custom_id title", async () => {
      const modal = modalJSON((await runExecute()).modals);
      const input = modal.components[0].component;
      expect(input.type).to.equal(4);
      expect(input.custom_id).to.equal("title");
      expect(input.style).to.equal(1);
      expect(input.required).to.equal(true);
    });

    it("criterion 1: Description is a required paragraph text input with custom_id description", async () => {
      const modal = modalJSON((await runExecute()).modals);
      const input = modal.components[1].component;
      expect(input.type).to.equal(4);
      expect(input.custom_id).to.equal("description");
      expect(input.style).to.equal(2);
      expect(input.required).to.equal(true);
    });
  });

  describe("-criterion 7: field length limits", () => {
    it("criterion 7: Title text input has max_length 100", async () => {
      const modal = modalJSON((await runExecute()).modals);
      expect(modal.components[0].component.max_length).to.equal(100);
    });

    it("criterion 7: Description text input has max_length 1000", async () => {
      const modal = modalJSON((await runExecute()).modals);
      expect(modal.components[1].component.max_length).to.equal(1000);
    });

    it("criterion 7 (edge): max-length title and description are posted verbatim", async () => {
      const title = "T".repeat(TITLE_MAX);
      const description = "D".repeat(DESCRIPTION_MAX);
      const ctx = await runSubmit({ title, description });
      const embed = sentEmbed(sentPayload(ctx.sends));
      expect(embed.title).to.equal(title);
      expect(embed.description).to.equal(description);
    });
  });

  describe("-criterion 9: not available in DMs", () => {
    it("criterion 9: data contexts are exactly [Guild]", () => {
      expect(data.toJSON().contexts).to.deep.equal([InteractionContextType.Guild]);
    });

    it("criterion 9: outside a guild, execute replies ephemerally that it only works in the server and opens no modal", async () => {
      const ctx = await runExecute({ inGuild: false });
      expect(ctx.modals).to.deep.equal([]);
      expect(ctx.replies).to.have.lengthOf(1);
      expect(isEphemeral(ctx.replies[0])).to.equal(true);
      expect(contentOf(ctx.replies[0]).toLowerCase()).to.include("server");
    });
  });

  describe("-criterion 2: submission posts to the channel", () => {
    it("criterion 2: fetches the channel named by FEATURE_REQUEST_CHANNEL_ID", async () => {
      const ctx = await runSubmit();
      expect(ctx.fetchedIds).to.include(CHANNEL_ID);
    });

    it("criterion 2: sends one embed with the title, description, and a 'Submitted by' field mentioning the submitter", async () => {
      const ctx = await runSubmit({ title: "Dark mode", description: "Please add dark mode to the bot." });
      const embed = sentEmbed(sentPayload(ctx.sends));
      expect(embed.title).to.equal("Dark mode");
      expect(embed.description).to.equal("Please add dark mode to the bot.");
      expect(embed.fields).to.be.an("array");
      const field = (embed.fields as Payload[]).find((f) => f.name === "Submitted by");
      expect(field, "Submitted by field").to.not.equal(undefined);
      expect(field!.value).to.equal(`<@${SUBMITTER_ID}>`);
    });

    it("criterion 2 (edge): whitespace-only input is accepted and posted", async () => {
      const ctx = await runSubmit({ title: "   ", description: "  \n  " });
      expect(ctx.sends).to.have.lengthOf(1);
      const text = contentOf(finalSubmitReply(ctx)).toLowerCase();
      expect(text).to.include("submitted");
    });
  });

  describe("-criterion 3: maintainer mention", () => {
    it("criterion 3: content mentions the configured maintainer", async () => {
      const payload = sentPayload((await runSubmit()).sends);
      expect(contentOf(payload)).to.include(`<@${MAINTAINER_ID}>`);
    });

    it("criterion 3: allowedMentions is exactly { parse: [], users: [maintainer] }", async () => {
      const payload = sentPayload((await runSubmit()).sends);
      expect(payload.allowedMentions).to.deep.equal({ parse: [], users: [MAINTAINER_ID] });
    });

    it("criterion 3 (edge): maintainer unset -> still posts, no maintainer mention, allowedMentions { parse: [], users: [] }", async () => {
      delete process.env.FEATURE_REQUEST_MAINTAINER_ID;
      const ctx = await runSubmit();
      const payload = sentPayload(ctx.sends);
      const content = contentOf(payload);
      expect(content).to.not.include(`<@${MAINTAINER_ID}>`);
      expect(content.split(`<@${SUBMITTER_ID}>`).join("")).to.not.match(/<@!?\d+>/);
      expect(payload.allowedMentions).to.deep.equal({ parse: [], users: [] });
      expect(contentOf(finalSubmitReply(ctx)).toLowerCase()).to.include("submitted");
    });

    it("criterion 3: env vars are read at call time (changing maintainer between submits takes effect)", async () => {
      const first = sentPayload((await runSubmit({ userId: SUBMITTER_ID })).sends);
      expect(first.allowedMentions).to.deep.equal({ parse: [], users: [MAINTAINER_ID] });
      process.env.FEATURE_REQUEST_MAINTAINER_ID = "444444444444444444";
      const second = sentPayload((await runSubmit({ userId: OTHER_USER_ID })).sends);
      expect(contentOf(second)).to.include("<@444444444444444444>");
      expect(second.allowedMentions).to.deep.equal({ parse: [], users: ["444444444444444444"] });
    });
  });

  describe("-criterion 4: ephemeral confirmation without a link", () => {
    it("criterion 4: deferReply is ephemeral and the final reply says the request was submitted", async () => {
      const ctx = await runSubmit();
      expect(ctx.deferReplies).to.have.lengthOf(1);
      expect(isEphemeral(ctx.deferReplies[0])).to.equal(true);
      expect(contentOf(finalSubmitReply(ctx)).toLowerCase()).to.include("submitted");
    });

    it("criterion 4: confirmation contains no URL or message link", async () => {
      const ctx = await runSubmit();
      const reply = finalSubmitReply(ctx);
      const text = contentOf(reply);
      expect(text).to.not.match(/https?:\/\//);
      expect(text).to.not.include("discord.com/channels");
      expect(text).to.not.include("555555555555555555");
      expect(inspect(reply, { depth: null })).to.not.include("discord.com/channels");
    });
  });

  describe("-criterion 5: cooldown", () => {
    it("criterion 5: after a successful submit, execute replies ephemerally with a relative timestamp and opens no modal", async () => {
      const before = Date.now();
      await runSubmit();
      const after = Date.now();
      const text = expectOnCooldownReply(await runExecute());
      const match = /<t:(\d+):R>/.exec(text);
      expect(match, "relative timestamp").to.not.equal(null);
      const unix = Number(match![1]);
      expect(unix).to.be.at.least(Math.floor((before + COOLDOWN_MS) / 1000));
      expect(unix).to.be.at.most(Math.floor((after + COOLDOWN_MS) / 1000));
    });

    it("criterion 5: cooldown reply contains the exact <t:unix:R> for last submit + 1 hour", async () => {
      const last = Date.now() - 10 * 60 * 1000;
      _setCooldown(SUBMITTER_ID, last);
      const text = expectOnCooldownReply(await runExecute());
      expect(text).to.include(relTimestamp(last));
    });

    it("criterion 5: cooldown is per user (another user can still open the modal)", async () => {
      _setCooldown(SUBMITTER_ID, Date.now());
      await expectModalOpens(OTHER_USER_ID);
    });

    it("criterion 5 (edge): no moderator bypass -- an admin on cooldown still gets the cooldown reply", async () => {
      const last = Date.now() - 60 * 1000;
      _setCooldown(SUBMITTER_ID, last);
      const text = expectOnCooldownReply(await runExecute({ admin: true }));
      expect(text).to.include(relTimestamp(last));
    });

    it("criterion 5 (edge): cooldown expires once now >= last + COOLDOWN_MS", async () => {
      _setCooldown(SUBMITTER_ID, Date.now() - COOLDOWN_MS - 1000);
      await expectModalOpens();
    });

    it("criterion 5 (edge): still on cooldown just before expiry", async () => {
      const last = Date.now() - COOLDOWN_MS + 60 * 1000;
      _setCooldown(SUBMITTER_ID, last);
      const text = expectOnCooldownReply(await runExecute());
      expect(text).to.include(relTimestamp(last));
    });

    it("criterion 5 (edge): submit-time re-check rejects with the cooldown message and sends nothing", async () => {
      const last = Date.now() - 5 * 60 * 1000;
      _setCooldown(SUBMITTER_ID, last);
      const ctx = await runSubmit();
      expect(ctx.sends).to.deep.equal([]);
      expectSubmitEphemeral(ctx);
      expect(contentOf(finalSubmitReply(ctx))).to.include(relTimestamp(last));
    });

    it("criterion 5 (edge): two modals opened before submitting -> only the first submit posts", async () => {
      await expectModalOpens();
      await expectModalOpens();
      const first = await runSubmit();
      expect(first.sends).to.have.lengthOf(1);
      const second = await runSubmit();
      expect(second.sends).to.deep.equal([]);
      expect(contentOf(finalSubmitReply(second))).to.match(/<t:\d+:R>/);
    });
  });

  describe("-criterion 6: opening the modal alone starts no cooldown", () => {
    it("criterion 6: after execute opens the modal, a second execute still opens the modal", async () => {
      await expectModalOpens();
      await expectModalOpens();
    });

    it("criterion 6: after execute opens the modal, a later submit still posts", async () => {
      await expectModalOpens();
      const ctx = await runSubmit();
      expect(ctx.sends).to.have.lengthOf(1);
    });
  });

  describe("-criterion 8: channel missing or unpostable", () => {
    const failureModes: { name: string; setup: () => void; channel?: ChannelMode; expectSendAttempt?: boolean }[] = [
      { name: "FEATURE_REQUEST_CHANNEL_ID unset", setup: () => { delete process.env.FEATURE_REQUEST_CHANNEL_ID; } },
      { name: "channel fetch rejects", setup: () => {}, channel: "fetchRejects" },
      { name: "channel fetch returns null", setup: () => {}, channel: "fetchNull" },
      { name: "channel cannot send", setup: () => {}, channel: "noSend" },
      { name: "send rejects", setup: () => {}, channel: "sendRejects", expectSendAttempt: true },
    ];

    for (const mode of failureModes) {
      it(`criterion 8: ${mode.name} -> ephemeral "couldn't be filed" error`, async () => {
        mode.setup();
        const ctx = await runSubmit({ channel: mode.channel });
        expectCouldNotBeFiled(ctx);
      });

      it(`criterion 8: ${mode.name} -> nothing is posted`, async () => {
        mode.setup();
        const ctx = await runSubmit({ channel: mode.channel });
        if (mode.expectSendAttempt) expect(ctx.sends).to.have.lengthOf(1);
        else expect(ctx.sends).to.deep.equal([]);
      });

      it(`criterion 8: ${mode.name} -> no cooldown starts (execute still opens the modal)`, async () => {
        mode.setup();
        await runSubmit({ channel: mode.channel });
        await expectModalOpens();
      });

      it(`criterion 8: ${mode.name} -> logs do not contain the raw title or description`, async () => {
        mode.setup();
        await runSubmit({
          channel: mode.channel,
          title: "zebra-quokka-title-7731",
          description: "zebra-quokka-description-9902",
        });
        const text = allLogText();
        expect(text).to.not.include("zebra-quokka-title-7731");
        expect(text).to.not.include("zebra-quokka-description-9902");
      });
    }

    it("criterion 8: confirmation is not sent on failure", async () => {
      const ctx = await runSubmit({ channel: "sendRejects" });
      const text = normalizeApostrophes(contentOf(finalSubmitReply(ctx)).toLowerCase());
      expect(text).to.include("couldn't be filed");
      expect(ctx.editReplies.concat(ctx.replies, ctx.followUps)).to.have.lengthOf(1);
    });
  });

  describe("-criterion 10: submitted text cannot ping anyone", () => {
    const hostile = "@everyone @here <@&999> <@111>";

    it("criterion 10: with mentions in title and description, allowedMentions.parse is [] and users is only the maintainer", async () => {
      const ctx = await runSubmit({ title: hostile, description: `${hostile} please` });
      const payload = sentPayload(ctx.sends);
      expect(payload.allowedMentions.parse).to.deep.equal([]);
      expect(payload.allowedMentions.users).to.deep.equal([MAINTAINER_ID]);
      expect(payload.allowedMentions).to.deep.equal({ parse: [], users: [MAINTAINER_ID] });
    });

    it("criterion 10: with maintainer unset, hostile text yields allowedMentions { parse: [], users: [] }", async () => {
      delete process.env.FEATURE_REQUEST_MAINTAINER_ID;
      const ctx = await runSubmit({ title: hostile, description: hostile });
      const payload = sentPayload(ctx.sends);
      expect(payload.allowedMentions).to.deep.equal({ parse: [], users: [] });
    });
  });
});
