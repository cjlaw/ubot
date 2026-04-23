import "dotenv/config.js";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  Partials,
} from "discord.js";
import { handleUpvoteReaction, handleTwssReaction } from "./helpers/reaction_helper.js";
import { handleArnieMention } from "./helpers/arnie_helper.js";
import { handleFacepalmMention } from "./helpers/facepalm_helper.js";

const token = process.env.bot_token;
const facepalmEnabled = process.env.facepalmEnabled === "true";

if (!token) {
  console.error("Error: bot_token is not set in environment variables.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

const __dirname = import.meta.dirname;

client.commands = new Collection();
const commandsPath = join(__dirname, "commands");
const commandFiles = readdirSync(commandsPath).filter((file) =>
  file.endsWith(".js")
);

for (const file of commandFiles) {
  const filePath = join(commandsPath, file);
  const command = await import(filePath);
  client.commands.set(command.data.name, command);
}

let arnieEmoji;
client.once(Events.ClientReady, () => {
  arnieEmoji = client.emojis.cache.find((e) => e.name === "sbfvgsArnie");
  if (!arnieEmoji) console.warn("Warning: sbfvgsArnie emoji not found — Arnie responses will not include the emoji");
  console.log("ubot is ready!");
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "There was an error while executing this command!",
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: "There was an error while executing this command!",
        ephemeral: true,
      });
    }
  }
});

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (error) {
      console.error("Something went wrong when fetching the message:", error);
      return;
    }
  }

  if (reaction.emoji.name === "upvote") {
    reaction.message.channel.send(handleUpvoteReaction(reaction, user));
  }

  if (reaction.emoji.name === "twss") {
    reaction.message.channel.send(handleTwssReaction(reaction, user));
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (!message.content || message.author.bot) return;

  const arnieMessage = handleArnieMention(message, arnieEmoji);
  if (arnieMessage) message.channel.send(arnieMessage);

  if (facepalmEnabled) {
    const facepalmMessage = handleFacepalmMention(message);
    if (facepalmMessage) message.channel.send(facepalmMessage);
  }
});

client.login(token);
