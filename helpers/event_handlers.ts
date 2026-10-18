import type { EventEmitter } from "node:events";
import { Events } from "discord.js";
import type {
  GuildEmoji,
  Interaction,
  Message,
  MessageReaction,
  PartialMessageReaction,
  PartialUser,
  User,
} from "discord.js";
import { handleUpvoteReaction, handleTwssReaction } from "./reaction_helper.js";
import { handleArnieMention } from "./arnie_helper.js";
import { handleFacepalmMention } from "./facepalm_helper.js";
import { formatError } from "./error_helper.js";
import type { Command } from "../types.js";

export async function handleInteraction(
  interaction: Interaction,
  commands: { get(name: string): Command | undefined },
): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);

  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Command ${interaction.commandName} failed:`, formatError(error));
    const payload = {
      content: "There was an error while executing this command!",
      ephemeral: true,
    };
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload);
      } else {
        await interaction.reply(payload);
      }
    } catch (replyError) {
      console.error("Failed to send command error reply:", formatError(replyError));
    }
  }
}

export async function handleReaction(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
): Promise<void> {
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (error) {
      console.error("Something went wrong when fetching the message:", error);
      return;
    }
  }

  const channel = reaction.message.channel;
  if (!("send" in channel)) return;

  try {
    if (reaction.emoji.name === "upvote") {
      await channel.send(handleUpvoteReaction(reaction as MessageReaction, user as User));
    }

    if (reaction.emoji.name === "twss") {
      await channel.send(handleTwssReaction(reaction as MessageReaction, user as User));
    }
  } catch (error) {
    console.error("Failed to send reaction reply:", formatError(error));
  }
}

export async function handleMessage(
  message: Message,
  arnieEmoji: GuildEmoji | undefined,
  facepalmEnabled: boolean,
): Promise<void> {
  if (!message.content || message.author.bot) return;

  const channel = message.channel;
  if (!("send" in channel)) return;

  try {
    const arnieMessage = handleArnieMention(message, arnieEmoji);
    if (arnieMessage) await channel.send(arnieMessage);
  } catch (error) {
    console.error("Failed to send Arnie reply:", formatError(error));
  }

  if (facepalmEnabled) {
    try {
      const facepalmMessage = handleFacepalmMention(message);
      if (facepalmMessage) await channel.send(facepalmMessage);
    } catch (error) {
      console.error("Failed to send facepalm reply:", formatError(error));
    }
  }
}

export function registerProcessHandlers(
  proc: EventEmitter,
  exit: (code: number) => void,
): void {
  proc.on("unhandledRejection", (reason: unknown) => {
    console.error("Unhandled rejection:", formatError(reason));
  });
  proc.on("uncaughtException", (err: unknown) => {
    console.error("Uncaught exception:", formatError(err));
    exit(1);
  });
}

export function registerClientLogging(client: EventEmitter): void {
  client.on(Events.Error, (error: unknown) => {
    console.error("Client error:", formatError(error));
  });
  client.on(Events.ShardError, (error: unknown, shardId: number) => {
    console.error(`Shard ${shardId} error:`, formatError(error));
  });
  client.on(Events.ShardDisconnect, (closeEvent: { code: number }, shardId: number) => {
    console.error(`Shard ${shardId} disconnected (close code ${closeEvent.code}); it will not reconnect`);
  });
  client.on(Events.ShardReconnecting, (shardId: number) => {
    console.warn(`Shard ${shardId} reconnecting`);
  });
  client.on(Events.ShardResume, (shardId: number, replayedEvents: number) => {
    console.log(`Shard ${shardId} resumed (${replayedEvents} events replayed)`);
  });
}
