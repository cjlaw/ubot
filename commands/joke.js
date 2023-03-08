const { SlashCommandBuilder } = require("discord.js");
const { request } = require("undici");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("joke")
    .setDescription("Replies with a dad joke"),
  async execute(interaction) {
    try {
      let jokeResult = await request("https://icanhazdadjoke.com/", {
        headers: { Accept: "text/plain" },
      });
      let response = await jokeResult.body.text();
      return interaction.reply(response);
    } catch (error) {
      console.log(`An error occurred in the joke command: ${error}`);
    }
  },
};
