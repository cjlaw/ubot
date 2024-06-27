import { SlashCommandBuilder } from "discord.js";
import { request } from "undici";

export const data = new SlashCommandBuilder()
  .setName("joke")
  .setDescription("Replies with a dad joke");
export async function execute(interaction) {
  try {
    let jokeResult = await request("https://icanhazdadjoke.com/", {
      headers: { Accept: "text/plain" },
    });
    let response = await jokeResult.body.text();
    return interaction.reply(response);
  } catch (error) {
    console.log(`An error occurred in the joke command: ${error}`);
  }
}
