import "dotenv/config.js";
import { REST, Routes, SlashCommandBuilder } from "discord.js";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { Command } from "./types.js";

const __dirname = import.meta.dirname;

const token = process.env.bot_token;
const clientId = process.env.clientId;
const guildId = process.env.guildId;

if (!token || !clientId || !guildId) {
  console.error("Error: bot_token, clientId, and guildId must all be set in environment variables.");
  process.exit(1);
}

const commands: ReturnType<SlashCommandBuilder["toJSON"]>[] = [];
const commandsPath = join(__dirname, "commands");
const commandFiles = readdirSync(commandsPath).filter((file) =>
  file.endsWith(".js")
);

for (const file of commandFiles) {
  const command = await import(join(commandsPath, file)) as Command;
  commands.push(command.data.toJSON());
}

const rest = new REST({ version: "10" }).setToken(token);

(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    );

    console.log(`Successfully reloaded ${commands.length} application (/) commands.`);
  } catch (error) {
    console.error(error);
  }
})();
