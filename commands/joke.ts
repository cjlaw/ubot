import { SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("joke")
  .setDescription("Replies with a dad joke");

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();
  try {
    const jokeResult = await fetch("https://icanhazdadjoke.com/", {
      headers: { Accept: "text/plain" },
    });
    const response = await jokeResult.text();
    await interaction.editReply(response);
  } catch (error) {
    console.error(`An error occurred in the joke command: ${error}`);
    await interaction.editReply("Sorry, I couldn't fetch a joke right now :(");
  }
}
