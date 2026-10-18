import "dotenv/config.js";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  Partials,
  Status,
} from "discord.js";
import {
  handleInteraction,
  handleReaction,
  handleMessage,
  registerProcessHandlers,
  registerClientLogging,
} from "./helpers/event_handlers.js";
import { formatError } from "./helpers/error_helper.js";
import { getEpisodes } from "./helpers/episode_helper.js";
import type { Command } from "./types.js";

const token = process.env.bot_token;
const facepalmEnabled = process.env.facepalmEnabled === "true";
const kumaPushUrl = process.env.KUMA_PUSH_URL;

if (!token) {
  console.error("Error: bot_token is not set in environment variables.");
  process.exit(1);
}

registerProcessHandlers(process, (code) => process.exit(code));

class UbotClient extends Client {
  commands = new Collection<string, Command>();
}

const client = new UbotClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

registerClientLogging(client);

const __dirname = import.meta.dirname;

const commandsPath = join(__dirname, "commands");
const commandFiles = readdirSync(commandsPath).filter((file) =>
  file.endsWith(".js")
);

for (const file of commandFiles) {
  const filePath = join(commandsPath, file);
  const command = await import(filePath) as Command;
  client.commands.set(command.data.name, command);
}

let arnieEmoji: ReturnType<typeof client.emojis.cache.find>;
client.once(Events.ClientReady, () => {
  arnieEmoji = client.emojis.cache.find((e) => e.name === "sbfvgsArnie");
  if (!arnieEmoji) console.warn("Warning: sbfvgsArnie emoji not found — Arnie responses will not include the emoji");
  if (!process.env.ANTHROPIC_API_KEY) console.warn("Warning: ANTHROPIC_API_KEY is not set — /findepisode will use fuzzy fallback only");
  getEpisodes().catch(err => console.error("Failed to warm episode cache:", (err as Error).message));
  if (kumaPushUrl) {
    setInterval(() => {
      // isReady() stays true through gateway outages; only per-shard status tracks reconnects
      if (!client.isReady() || !client.ws.shards.every((s) => s.status === Status.Ready)) return;
      fetch(`${kumaPushUrl}?status=up&msg=OK&ping=${client.ws.ping}`).catch(() => {});
    }, 60_000);
  }
  console.log("ubot is ready!");
});

client.on(Events.InteractionCreate, (interaction) => {
  void handleInteraction(interaction, client.commands);
});

client.on(Events.MessageReactionAdd, (reaction, user) => {
  void handleReaction(reaction, user);
});

client.on(Events.MessageCreate, (message) => {
  void handleMessage(message, arnieEmoji, facepalmEnabled);
});

client.login(token).catch((err: unknown) => {
  console.error("Failed to log in:", formatError(err));
  process.exit(1);
});
