import "dotenv/config.js";
import path from "path";
import { fileURLToPath } from "url";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  Partials,
} from "discord.js";
const token = process.env.bot_token;
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});
import { ReactionHelper } from "./helpers/reaction_helper.js";
import { ArnieHelper } from "./helpers/arnie_helper.js";
import { FacepalmHelper } from "./helpers/facepalm_helper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

client.once(Events.ClientReady, () => {
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
  // When a reaction is received, check if the structure is partial
  if (reaction.partial) {
    // If the message this reaction belongs to was removed, the fetching might result in an API error which should be handled
    try {
      await reaction.fetch();
    } catch (error) {
      console.error("Something went wrong when fetching the message:", error);
      // Return as `reaction.message.author` may be undefined/null
      return;
    }
  }

  if (reaction.emoji.name === "upvote") {
    reaction.message.channel.send(
      ReactionHelper.handleUpvoteReaction(reaction, user)
    );
  }

  if (reaction.emoji.name === "twss") {
    reaction.message.channel.send(
      ReactionHelper.handleTwssReaction(reaction, user)
    );
  }
});

const facepalmEnabled = process.env.facepalmEnabled;

client.on(Events.MessageCreate, async (message) => {
  if (!message.content) return;

  let arnieMessage = ArnieHelper.handleArnieMention(message);
  if (arnieMessage) message.channel.send(arnieMessage);

  if (facepalmEnabled == "true") {
    let facepalmMessage = FacepalmHelper.handleFacepalmMention(message);
    if (facepalmMessage) {
      message.channel.send(facepalmMessage);
    }
  }
});

client.login(token);
