import { expect } from "chai";
import { EventEmitter } from "node:events";
import { inspect } from "node:util";
import type { GuildEmoji, Interaction, Message, MessageReaction, ModalSubmitInteraction, User } from "discord.js";
import {
  handleInteraction,
  handleReaction,
  handleMessage,
  registerProcessHandlers,
  registerClientLogging,
} from "../helpers/event_handlers.js";
import { formatError } from "../helpers/error_helper.js";
import { handleUpvoteReaction, handleTwssReaction } from "../helpers/reaction_helper.js";
import { handleArnieMention } from "../helpers/arnie_helper.js";
import { handleFacepalmMention } from "../helpers/facepalm_helper.js";
import type { Command } from "../types.js";

const ERROR_REPLY = { content: "There was an error while executing this command!", ephemeral: true };
const SECRET_CONTENT = "zebra-quokka-secret-8841";

type Calls = unknown[][];
const logs: { error: Calls; warn: Calls; log: Calls } = { error: [], warn: [], log: [] };
const original = {
  error: console.error.bind(console),
  warn: console.warn.bind(console),
  log: console.log.bind(console),
};
const originalRandom = Math.random.bind(Math);

const stringify = (arg: unknown): string =>
  typeof arg === "string" ? arg : inspect(arg, { depth: null });
const callText = (args: unknown[]): string => args.map(stringify).join(" ");
const allText = (calls: Calls): string => calls.map(callText).join("\n");
const allStrings = (calls: Calls): boolean => calls.every((args) => args.every((arg) => typeof arg === "string"));

const permError = (content: string): Error =>
  Object.assign(new Error("Missing Permissions"), {
    code: 50013,
    requestBody: { json: { content } },
  });

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

const user = { id: "5678" } as unknown as User;

const arnieEmojiId = "894993017784643624";
const arnieEmoji = {
  id: arnieEmojiId,
  toString: () => `<:sbfvgsArnie:${arnieEmojiId}>`,
} as unknown as GuildEmoji;

type SendFn = (content: string) => Promise<unknown>;

const makeReaction = (opts: {
  emojiName: string;
  content: string;
  send?: SendFn;
  noSend?: boolean;
  partial?: boolean;
  fetch?: () => Promise<unknown>;
}) => {
  const sent: string[] = [];
  const send: SendFn = opts.send ?? (async (content: string) => { sent.push(content); });
  const recordingSend: SendFn = async (content: string) => {
    if (opts.send) sent.push(content);
    return send(content);
  };
  const channel = opts.noSend ? {} : { send: recordingSend };
  const reaction = {
    partial: opts.partial ?? false,
    emoji: {
      name: opts.emojiName,
      id: "111",
      toString: () => `<:${opts.emojiName}:111>`,
    },
    message: {
      content: opts.content,
      author: { id: "1234" },
      channel,
    },
    fetch: opts.fetch,
  };
  if (!reaction.fetch) reaction.fetch = async () => reaction;
  return { reaction: reaction as unknown as MessageReaction, sent };
};

const failingSend: SendFn = async (content: string) => { throw permError(content); };

const makeMessage = (opts: {
  content: string;
  bot?: boolean;
  send?: SendFn;
  react?: (emoji: string) => Promise<unknown>;
}) => {
  const sent: string[] = [];
  const reacted: string[] = [];
  const message = {
    content: opts.content,
    author: { id: "4321", bot: opts.bot ?? false },
    channel: {
      send: async (content: string) => {
        sent.push(content);
        if (opts.send) return opts.send(content);
      },
    },
    react: async (emoji: string) => {
      reacted.push(emoji);
      if (opts.react) return opts.react(emoji);
    },
  };
  return { message: message as unknown as Message, sent, reacted };
};

const facepalmReplyText = (): string => {
  const throwaway = { content: "Trump", react: async () => {} } as unknown as Message;
  return handleFacepalmMention(throwaway)!;
};

const makeInteraction = (opts: {
  commandName?: string;
  chatInput?: boolean;
  modalSubmit?: boolean;
  customId?: string;
  replied?: boolean;
  deferred?: boolean;
  reply?: (payload: unknown) => Promise<unknown>;
  followUp?: (payload: unknown) => Promise<unknown>;
}) => {
  const replies: unknown[] = [];
  const followUps: unknown[] = [];
  const interaction = {
    commandName: opts.commandName,
    customId: opts.customId,
    replied: opts.replied ?? false,
    deferred: opts.deferred ?? false,
    isChatInputCommand: () => opts.chatInput ?? true,
    isModalSubmit: () => opts.modalSubmit ?? false,
    reply: async (payload: unknown) => {
      replies.push(payload);
      if (opts.reply) return opts.reply(payload);
    },
    followUp: async (payload: unknown) => {
      followUps.push(payload);
      if (opts.followUp) return opts.followUp(payload);
    },
  };
  return { interaction: interaction as unknown as Interaction, replies, followUps };
};

const makeCommands = (execute: Command["execute"]) => {
  const executed: unknown[] = [];
  const command: Command = {
    data: {} as Command["data"],
    execute: async (interaction) => {
      executed.push(interaction);
      return execute(interaction);
    },
  };
  return { commands: new Map<string, Command>([["boom", command]]), executed };
};

const makeModalCommands = (opts: {
  name?: string;
  handleModalSubmit?: (interaction: ModalSubmitInteraction) => Promise<void>;
  withoutModalHandler?: boolean;
} = {}) => {
  const executed: unknown[] = [];
  const submitted: unknown[] = [];
  const command: Command = {
    data: {} as Command["data"],
    execute: async (interaction) => { executed.push(interaction); },
  };
  if (!opts.withoutModalHandler) {
    command.handleModalSubmit = async (interaction) => {
      submitted.push(interaction);
      if (opts.handleModalSubmit) return opts.handleModalSubmit(interaction);
    };
  }
  return { commands: new Map<string, Command>([[opts.name ?? "featurerequest", command]]), executed, submitted };
};

const modalInteraction = (customId: string, extra: Parameters<typeof makeInteraction>[0] = {}) =>
  makeInteraction({ chatInput: false, modalSubmit: true, customId, ...extra });

const throwingModalCommands = () =>
  makeModalCommands({ handleModalSubmit: async () => { throw new Error("Modal exploded"); } });

const throwingCommands = () => makeCommands(async () => { throw new Error("Command exploded"); });

describe("#event handlers (acceptance)", () => {
  beforeEach(() => {
    logs.error = [];
    logs.warn = [];
    logs.log = [];
    console.error = (...args: unknown[]) => { logs.error.push(args); };
    console.warn = (...args: unknown[]) => { logs.warn.push(args); };
    console.log = (...args: unknown[]) => { logs.log.push(args); };
  });

  afterEach(() => {
    console.error = original.error;
    console.warn = original.warn;
    console.log = original.log;
    Math.random = originalRandom;
  });

  describe("-formatError (supports logging in criteria 1-3, 5-7)", () => {
    it("formatError: returns the stack for an Error", () => {
      const err = new Error("stacky");
      expect(formatError(err)).to.equal(err.stack);
    });

    it("formatError: falls back to the message for an Error without a stack", () => {
      const err = new Error("no stack here");
      err.stack = undefined;
      expect(formatError(err)).to.equal("no stack here");
    });

    it("formatError: stringifies non-Error values", () => {
      expect(formatError("plain reason")).to.equal("plain reason");
      expect(formatError(42)).to.equal("42");
    });

    it("formatError: does not include requestBody content of a Discord API error", () => {
      expect(formatError(permError(SECRET_CONTENT))).to.not.include(SECRET_CONTENT);
    });
  });

  describe("-criterion 1: upvote/twss reaction in a channel without send permission", () => {
    it("criterion 1: upvote send rejecting resolves, posts nothing, and logs the failure", async () => {
      const { reaction } = makeReaction({ emojiName: "upvote", content: SECRET_CONTENT, send: failingSend });
      await handleReaction(reaction, user);
      expect(logs.error.length).to.be.at.least(1);
      expect(allText(logs.error)).to.include("Missing Permissions");
    });

    it("criterion 1: twss send rejecting resolves and logs the failure", async () => {
      const { reaction } = makeReaction({ emojiName: "twss", content: SECRET_CONTENT, send: failingSend });
      await handleReaction(reaction, user);
      expect(logs.error.length).to.be.at.least(1);
      expect(allText(logs.error)).to.include("Missing Permissions");
    });

    it("criterion 1: upvote failure log does not contain the user's original message content", async () => {
      const { reaction } = makeReaction({ emojiName: "upvote", content: SECRET_CONTENT, send: failingSend });
      await handleReaction(reaction, user);
      for (const args of logs.error.concat(logs.warn, logs.log)) {
        for (const arg of args) {
          expect(inspect(arg, { depth: null })).to.not.include(SECRET_CONTENT);
        }
      }
    });

    it("criterion 1: twss failure log does not contain the user's original message content", async () => {
      const { reaction } = makeReaction({ emojiName: "twss", content: SECRET_CONTENT, send: failingSend });
      await handleReaction(reaction, user);
      for (const args of logs.error.concat(logs.warn, logs.log)) {
        for (const arg of args) {
          expect(inspect(arg, { depth: null })).to.not.include(SECRET_CONTENT);
        }
      }
    });

    it("criterion 1: the send that fails is attempted with the normal upvote reply (realistic failure)", async () => {
      const { reaction, sent } = makeReaction({ emojiName: "upvote", content: SECRET_CONTENT, send: failingSend });
      await handleReaction(reaction, user);
      expect(sent).to.deep.equal([handleUpvoteReaction(reaction, user)]);
    });

    it("criterion 1 (no dedup): two consecutive failing upvotes log two console.error calls", async () => {
      const first = makeReaction({ emojiName: "upvote", content: SECRET_CONTENT, send: failingSend });
      const second = makeReaction({ emojiName: "upvote", content: SECRET_CONTENT, send: failingSend });
      await handleReaction(first.reaction, user);
      await handleReaction(second.reaction, user);
      expect(logs.error).to.have.lengthOf(2);
    });

    it("criterion 1: after a failed upvote, a reaction in a working channel still sends the normal reply", async () => {
      const failing = makeReaction({ emojiName: "upvote", content: SECRET_CONTENT, send: failingSend });
      await handleReaction(failing.reaction, user);

      const working = makeReaction({ emojiName: "upvote", content: "great post" });
      await handleReaction(working.reaction, user);
      expect(working.sent).to.deep.equal([handleUpvoteReaction(working.reaction, user)]);
    });

    it("criterion 1: after a failed twss, mentions and commands elsewhere still respond", async () => {
      const failing = makeReaction({ emojiName: "twss", content: SECRET_CONTENT, send: failingSend });
      await handleReaction(failing.reaction, user);

      const { message, sent } = makeMessage({ content: "something about Trump" });
      await handleMessage(message, arnieEmoji, true);
      expect(sent).to.deep.equal([facepalmReplyText()]);

      const { commands, executed } = makeCommands(async () => {});
      const { interaction } = makeInteraction({ commandName: "boom" });
      await handleInteraction(interaction, commands);
      expect(executed).to.have.lengthOf(1);
    });

    it("criterion 1 (edge): partial reaction whose fetch fails logs the error, sends nothing, and resolves", async () => {
      const { reaction, sent } = makeReaction({
        emojiName: "upvote",
        content: "whatever",
        partial: true,
        fetch: async () => { throw new Error("Unknown Message"); },
      });
      await handleReaction(reaction, user);
      expect(sent).to.deep.equal([]);
      expect(logs.error.length).to.be.at.least(1);
      expect(allText(logs.error)).to.include("Unknown Message");
    });

    it("criterion 1 (edge): channel without send is a no-op", async () => {
      const { reaction } = makeReaction({ emojiName: "upvote", content: "hi", noSend: true });
      await handleReaction(reaction, user);
      expect(logs.error).to.deep.equal([]);
    });
  });

  describe("-criterion 2: Arnie/facepalm reply in a channel without send permission", () => {
    it("criterion 2: Arnie send rejecting resolves and logs the failure", async () => {
      const { message, sent } = makeMessage({ content: "hey arnie", send: failingSend });
      await handleMessage(message, arnieEmoji, false);
      expect(sent).to.have.lengthOf(1);
      expect(logs.error.length).to.be.at.least(1);
      expect(allText(logs.error)).to.include("Missing Permissions");
    });

    it("criterion 2: facepalm send rejecting resolves and logs the failure", async () => {
      const { message, sent } = makeMessage({ content: "something about Trump", send: failingSend });
      await handleMessage(message, arnieEmoji, true);
      expect(sent).to.deep.equal([facepalmReplyText()]);
      expect(logs.error.length).to.be.at.least(1);
      expect(allText(logs.error)).to.include("Missing Permissions");
    });

    it("criterion 2: facepalm react rejecting (via handleMessage) is logged and does not escape", async () => {
      const { message } = makeMessage({
        content: "something about Trump",
        react: async () => { throw Object.assign(new Error("Unknown Message"), { code: 10008 }); },
      });
      await handleMessage(message, arnieEmoji, true);
      await flush();
      expect(allText(logs.error)).to.include("Unknown Message");
    });

    it("criterion 2: handleFacepalmMention logs a rejected react and still returns the reply text", async () => {
      const message = {
        content: "something about Trump",
        react: async () => { throw Object.assign(new Error("Unknown Message"), { code: 10008 }); },
      } as unknown as Message;
      const result = handleFacepalmMention(message);
      expect(result).to.equal(facepalmReplyText());
      await flush();
      expect(allText(logs.error)).to.include("Unknown Message");
    });

    it("criterion 2: Arnie send rejecting does not prevent the facepalm send attempt", async () => {
      const facepalm = facepalmReplyText();
      const { message, sent } = makeMessage({
        content: "Arnie talking about Trump",
        send: async (content: string) => {
          if (content !== facepalm) throw permError(content);
        },
      });
      await handleMessage(message, arnieEmoji, true);
      expect(sent).to.have.lengthOf(2);
      expect(sent).to.include(facepalm);
      expect(allText(logs.error)).to.include("Missing Permissions");
    });

    it("criterion 2: when Arnie send, facepalm send, and react all reject, every failure is logged and the handler resolves", async () => {
      const { message, sent } = makeMessage({
        content: "Arnie talking about Trump",
        send: failingSend,
        react: async () => { throw Object.assign(new Error("Missing Access"), { code: 50001 }); },
      });
      await handleMessage(message, arnieEmoji, true);
      await flush();
      expect(sent).to.have.lengthOf(2);
      expect(logs.error.length).to.be.at.least(3);
      const text = allText(logs.error);
      expect(text).to.include("Missing Permissions");
      expect(text).to.include("Missing Access");
    });
  });

  describe("-criterion 3: command throws and the error reply also fails", () => {
    it("criterion 3: execute throws and reply rejects -> resolves and logs both errors", async () => {
      const { commands } = throwingCommands();
      const { interaction, replies } = makeInteraction({
        commandName: "boom",
        reply: async () => { throw Object.assign(new Error("Unknown interaction"), { code: 10062 }); },
      });
      await handleInteraction(interaction, commands);
      expect(replies).to.have.lengthOf(1);
      expect(logs.error.length).to.be.at.least(2);
      const text = allText(logs.error);
      expect(text).to.include("Command exploded");
      expect(text).to.include("Unknown interaction");
    });

    it("criterion 3: execute throws with deferred=true and followUp rejects -> resolves and logs both errors", async () => {
      const { commands } = throwingCommands();
      const { interaction, followUps } = makeInteraction({
        commandName: "boom",
        deferred: true,
        followUp: async () => { throw Object.assign(new Error("Unknown Webhook"), { code: 10015 }); },
      });
      await handleInteraction(interaction, commands);
      expect(followUps).to.have.lengthOf(1);
      expect(logs.error.length).to.be.at.least(2);
      const text = allText(logs.error);
      expect(text).to.include("Command exploded");
      expect(text).to.include("Unknown Webhook");
    });
  });

  describe("-criterion 4: command throws and the error reply succeeds", () => {
    it("criterion 4: not replied/deferred -> reply once with the exact ephemeral error payload", async () => {
      const { commands } = throwingCommands();
      const { interaction, replies, followUps } = makeInteraction({ commandName: "boom" });
      await handleInteraction(interaction, commands);
      expect(replies).to.deep.equal([ERROR_REPLY]);
      expect(followUps).to.deep.equal([]);
    });

    it("criterion 4: deferred=true -> followUp once with the exact ephemeral error payload", async () => {
      const { commands } = throwingCommands();
      const { interaction, replies, followUps } = makeInteraction({ commandName: "boom", deferred: true });
      await handleInteraction(interaction, commands);
      expect(followUps).to.deep.equal([ERROR_REPLY]);
      expect(replies).to.deep.equal([]);
    });

    it("criterion 4: replied=true -> followUp once with the exact ephemeral error payload", async () => {
      const { commands } = throwingCommands();
      const { interaction, replies, followUps } = makeInteraction({ commandName: "boom", replied: true });
      await handleInteraction(interaction, commands);
      expect(followUps).to.deep.equal([ERROR_REPLY]);
      expect(replies).to.deep.equal([]);
    });
  });

  describe("-criterion 5: unhandled promise rejection", () => {
    it("criterion 5: unhandledRejection with an Error is logged and exit is not called", () => {
      const proc = new EventEmitter();
      const exits: number[] = [];
      registerProcessHandlers(proc, (code: number) => { exits.push(code); });
      proc.emit("unhandledRejection", new Error("Dangling rejection"), Promise.resolve());
      expect(logs.error.length).to.be.at.least(1);
      expect(allText(logs.error)).to.include("Dangling rejection");
      expect(exits).to.deep.equal([]);
    });

    it("criterion 5 (edge): unhandledRejection with a non-Error reason is logged and exit is not called", () => {
      const proc = new EventEmitter();
      const exits: number[] = [];
      registerProcessHandlers(proc, (code: number) => { exits.push(code); });
      proc.emit("unhandledRejection", "plain string reason", Promise.resolve());
      expect(allText(logs.error)).to.include("plain string reason");
      expect(exits).to.deep.equal([]);
    });

    it("criterion 5 (no dedup): repeated identical rejections are each logged", () => {
      const proc = new EventEmitter();
      registerProcessHandlers(proc, () => {});
      proc.emit("unhandledRejection", new Error("Same again"), Promise.resolve());
      proc.emit("unhandledRejection", new Error("Same again"), Promise.resolve());
      expect(logs.error).to.have.lengthOf(2);
    });
  });

  describe("-criterion 6: uncaught synchronous exception", () => {
    it("criterion 6: uncaughtException is logged and then exit is called once with a non-zero code", () => {
      const proc = new EventEmitter();
      const order: string[] = [];
      const exits: number[] = [];
      console.error = (...args: unknown[]) => {
        order.push("log");
        logs.error.push(args);
      };
      registerProcessHandlers(proc, (code: number) => {
        order.push("exit");
        exits.push(code);
      });
      proc.emit("uncaughtException", new Error("Sync boom"), "uncaughtException");
      expect(allText(logs.error)).to.include("Sync boom");
      expect(exits).to.have.lengthOf(1);
      expect(exits[0]).to.not.equal(0);
      expect(order[0]).to.equal("log");
      expect(order[order.length - 1]).to.equal("exit");
    });
  });

  describe("-criterion 7: client error event", () => {
    it("criterion 7 (baseline): an unregistered EventEmitter throws on 'error'", () => {
      const client = new EventEmitter();
      expect(() => client.emit("error", new Error("Gateway kaboom"))).to.throw("Gateway kaboom");
    });

    it("criterion 7: after registerClientLogging, emitting 'error' does not throw and is logged", () => {
      const client = new EventEmitter();
      registerClientLogging(client);
      expect(() => client.emit("error", new Error("Gateway kaboom"))).to.not.throw();
      expect(logs.error).to.have.lengthOf(1);
      expect(allText(logs.error)).to.include("Gateway kaboom");
    });
  });

  describe("-criterion 8: gateway events are logged", () => {
    it("criterion 8: shardError logs once via console.error with the error message and shard id", () => {
      const client = new EventEmitter();
      registerClientLogging(client);
      client.emit("shardError", new Error("Socket hang up"), 7);
      expect(logs.error).to.have.lengthOf(1);
      const text = callText(logs.error[0]);
      expect(text).to.include("Socket hang up");
      expect(text).to.include("7");
    });

    it("criterion 8: shardDisconnect logs once via console.error with shard id and close code", () => {
      const client = new EventEmitter();
      registerClientLogging(client);
      client.emit("shardDisconnect", { code: 4004, reason: "", wasClean: false }, 7);
      expect(logs.error).to.have.lengthOf(1);
      const text = callText(logs.error[0]);
      expect(text).to.include("7");
      expect(text).to.include("4004");
    });

    it("criterion 8: shardReconnecting logs once via console.warn with shard id", () => {
      const client = new EventEmitter();
      registerClientLogging(client);
      client.emit("shardReconnecting", 7);
      expect(logs.warn).to.have.lengthOf(1);
      expect(callText(logs.warn[0])).to.include("7");
    });

    it("criterion 8: shardResume logs once via console.log with shard id", () => {
      const client = new EventEmitter();
      registerClientLogging(client);
      client.emit("shardResume", 7, 3);
      expect(logs.log).to.have.lengthOf(1);
      expect(callText(logs.log[0])).to.include("7");
    });
  });

  describe("-criterion 9: normal operation is unchanged", () => {
    it("criterion 9: upvote reaction sends exactly the handleUpvoteReaction output", async () => {
      const { reaction, sent } = makeReaction({ emojiName: "upvote", content: "test message" });
      await handleReaction(reaction, user);
      expect(sent).to.deep.equal([handleUpvoteReaction(reaction, user)]);
      expect(logs.error).to.deep.equal([]);
    });

    it("criterion 9: twss reaction sends exactly the handleTwssReaction output", async () => {
      const { reaction, sent } = makeReaction({ emojiName: "twss", content: "that is too short" });
      await handleReaction(reaction, user);
      expect(sent).to.deep.equal([handleTwssReaction(reaction, user)]);
      expect(logs.error).to.deep.equal([]);
    });

    it("criterion 9: partial reaction is fetched and then sends the normal upvote reply", async () => {
      let fetched = 0;
      const holder: { reaction?: MessageReaction } = {};
      const built = makeReaction({
        emojiName: "upvote",
        content: "partial post",
        partial: true,
        fetch: async () => { fetched += 1; return holder.reaction; },
      });
      holder.reaction = built.reaction;
      await handleReaction(built.reaction, user);
      expect(fetched).to.equal(1);
      expect(built.sent).to.deep.equal([handleUpvoteReaction(built.reaction, user)]);
    });

    it("criterion 9: other emoji reactions send nothing", async () => {
      const { reaction, sent } = makeReaction({ emojiName: "thumbsup", content: "hello" });
      await handleReaction(reaction, user);
      expect(sent).to.deep.equal([]);
    });

    it("criterion 9: Arnie mention sends the handleArnieMention reply including the emoji", async () => {
      Math.random = () => 0.5;
      const { message, sent } = makeMessage({ content: "hey arnie" });
      const expected = handleArnieMention(message, arnieEmoji);
      await handleMessage(message, arnieEmoji, false);
      expect(sent).to.deep.equal([expected]);
      expect(sent[0]).to.include(arnieEmoji.toString());
    });

    it("criterion 9: Arnie mention without an emoji sends the plain quote", async () => {
      Math.random = () => 0.1;
      const { message, sent } = makeMessage({ content: "Arnold rules" });
      const expected = handleArnieMention(message, undefined);
      await handleMessage(message, undefined, false);
      expect(sent).to.deep.equal([expected]);
    });

    it("criterion 9: a message that only uses the Arnie emoji sends nothing", async () => {
      const { message, sent } = makeMessage({ content: `arnie ${arnieEmoji.toString()}` });
      await handleMessage(message, arnieEmoji, false);
      expect(sent).to.deep.equal([]);
    });

    it("criterion 9: facepalm enabled sends the handleFacepalmMention reply and reacts", async () => {
      const { message, sent, reacted } = makeMessage({ content: "something about Trump" });
      await handleMessage(message, arnieEmoji, true);
      expect(sent).to.deep.equal([facepalmReplyText()]);
      expect(reacted).to.have.lengthOf(1);
      expect(logs.error).to.deep.equal([]);
    });

    it("criterion 9: facepalm disabled sends no facepalm reply and does not react", async () => {
      const { message, sent, reacted } = makeMessage({ content: "something about Trump" });
      await handleMessage(message, arnieEmoji, false);
      expect(sent).to.deep.equal([]);
      expect(reacted).to.deep.equal([]);
    });

    it("criterion 9: bot-authored message sends nothing", async () => {
      const { message, sent, reacted } = makeMessage({ content: "Arnie talking about Trump", bot: true });
      await handleMessage(message, arnieEmoji, true);
      expect(sent).to.deep.equal([]);
      expect(reacted).to.deep.equal([]);
    });

    it("criterion 9: empty-content message sends nothing", async () => {
      const { message, sent, reacted } = makeMessage({ content: "" });
      await handleMessage(message, arnieEmoji, true);
      expect(sent).to.deep.equal([]);
      expect(reacted).to.deep.equal([]);
    });

    it("criterion 9: successful command executes once with no reply/followUp and no console.error", async () => {
      const { commands, executed } = makeCommands(async () => {});
      const { interaction, replies, followUps } = makeInteraction({ commandName: "boom" });
      await handleInteraction(interaction, commands);
      expect(executed).to.deep.equal([interaction]);
      expect(replies).to.deep.equal([]);
      expect(followUps).to.deep.equal([]);
      expect(logs.error).to.deep.equal([]);
    });

    it("criterion 9: unknown command calls nothing", async () => {
      const { commands, executed } = throwingCommands();
      const { interaction, replies, followUps } = makeInteraction({ commandName: "nope" });
      await handleInteraction(interaction, commands);
      expect(executed).to.deep.equal([]);
      expect(replies).to.deep.equal([]);
      expect(followUps).to.deep.equal([]);
      expect(logs.error).to.deep.equal([]);
    });

    it("criterion 9: non-chat-input interaction calls nothing", async () => {
      const { commands, executed } = throwingCommands();
      const { interaction, replies, followUps } = makeInteraction({ commandName: "boom", chatInput: false });
      await handleInteraction(interaction, commands);
      expect(executed).to.deep.equal([]);
      expect(replies).to.deep.equal([]);
      expect(followUps).to.deep.equal([]);
      expect(logs.error).to.deep.equal([]);
    });
  });

  describe("-modal submit routing (#166 featurerequest)", () => {
    it("modal routing: modal submit with a matching customId calls that command's handleModalSubmit once with the interaction", async () => {
      const { commands, executed, submitted } = makeModalCommands();
      const { interaction, replies, followUps } = modalInteraction("featurerequest");
      await handleInteraction(interaction, commands);
      expect(submitted).to.deep.equal([interaction]);
      expect(executed).to.deep.equal([]);
      expect(replies).to.deep.equal([]);
      expect(followUps).to.deep.equal([]);
      expect(logs.error).to.deep.equal([]);
    });

    it("modal routing: unknown customId is a no-op (no handler, no reply, no log)", async () => {
      const { commands, executed, submitted } = makeModalCommands();
      const { interaction, replies, followUps } = modalInteraction("somethingelse");
      await handleInteraction(interaction, commands);
      expect(submitted).to.deep.equal([]);
      expect(executed).to.deep.equal([]);
      expect(replies).to.deep.equal([]);
      expect(followUps).to.deep.equal([]);
      expect(logs.error).to.deep.equal([]);
    });

    it("modal routing: customId is matched exactly (featurerequest:x does not route to featurerequest)", async () => {
      const { commands, executed, submitted } = makeModalCommands();
      const { interaction, replies, followUps } = modalInteraction("featurerequest:x");
      await handleInteraction(interaction, commands);
      expect(submitted).to.deep.equal([]);
      expect(executed).to.deep.equal([]);
      expect(replies).to.deep.equal([]);
      expect(followUps).to.deep.equal([]);
      expect(logs.error).to.deep.equal([]);
    });

    it("modal routing: command without handleModalSubmit is a no-op and execute is not called", async () => {
      const { commands, executed } = makeModalCommands({ withoutModalHandler: true });
      const { interaction, replies, followUps } = modalInteraction("featurerequest");
      await handleInteraction(interaction, commands);
      expect(executed).to.deep.equal([]);
      expect(replies).to.deep.equal([]);
      expect(followUps).to.deep.equal([]);
      expect(logs.error).to.deep.equal([]);
    });

    it("modal routing: handler throws -> error logged as strings and ephemeral error sent via reply", async () => {
      const { commands } = throwingModalCommands();
      const { interaction, replies, followUps } = modalInteraction("featurerequest");
      await handleInteraction(interaction, commands);
      expect(logs.error.length).to.be.at.least(1);
      expect(allStrings(logs.error)).to.equal(true);
      expect(allText(logs.error)).to.include("Modal exploded");
      expect(replies).to.deep.equal([ERROR_REPLY]);
      expect(followUps).to.deep.equal([]);
    });

    it("modal routing: handler throws with deferred=true -> ephemeral error sent via followUp", async () => {
      const { commands } = throwingModalCommands();
      const { interaction, replies, followUps } = modalInteraction("featurerequest", { deferred: true });
      await handleInteraction(interaction, commands);
      expect(followUps).to.deep.equal([ERROR_REPLY]);
      expect(replies).to.deep.equal([]);
      expect(allText(logs.error)).to.include("Modal exploded");
    });

    it("modal routing: handler throws with replied=true -> ephemeral error sent via followUp", async () => {
      const { commands } = throwingModalCommands();
      const { interaction, replies, followUps } = modalInteraction("featurerequest", { replied: true });
      await handleInteraction(interaction, commands);
      expect(followUps).to.deep.equal([ERROR_REPLY]);
      expect(replies).to.deep.equal([]);
    });

    it("modal routing: handler throws and the error reply rejects -> resolves and logs both errors", async () => {
      const { commands } = throwingModalCommands();
      const { interaction, replies } = modalInteraction("featurerequest", {
        reply: async () => { throw Object.assign(new Error("Unknown interaction"), { code: 10062 }); },
      });
      await handleInteraction(interaction, commands);
      expect(replies).to.have.lengthOf(1);
      const text = allText(logs.error);
      expect(text).to.include("Modal exploded");
      expect(text).to.include("Unknown interaction");
    });

    it("modal routing: chat-input interaction for a command with handleModalSubmit still calls execute only", async () => {
      const { commands, executed, submitted } = makeModalCommands();
      const { interaction, replies } = makeInteraction({ commandName: "featurerequest" });
      await handleInteraction(interaction, commands);
      expect(executed).to.deep.equal([interaction]);
      expect(submitted).to.deep.equal([]);
      expect(replies).to.deep.equal([]);
    });
  });
});
