import { SlashCommandBuilder } from "discord.js";
import { request } from "undici";

export const data = new SlashCommandBuilder()
  .setName("joke")
  .setDescription("Replies with a dad joke");

export async function execute(interaction) {
  await interaction.deferReply();
  try {
    const jokeResult = await request("https://icanhazdadjoke.com/", {
      headers: { Accept: "text/plain" },
    });
    const response = await jokeResult.body.text();
    await interaction.editReply(response);
  } catch (error) {
    console.error(`An error occurred in the joke command: ${error}`);
    await interaction.editReply("Sorry, I couldn't fetch a joke right now :(");
  }
}
