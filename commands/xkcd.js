import { SlashCommandBuilder } from "discord.js";
import { request } from "undici";

let _getRandomIntInclusive = (min, max) => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min; //The maximum is inclusive and the minimum is inclusive
};

export const data = new SlashCommandBuilder()
  .setName("xkcd")
  .setDescription("fetches a xkcd comic")
  .addStringOption((option) =>
    option
      .setName("selection")
      .setDescription(
        '"latest", "random", or specific comic number to get (e.g. "420")'
      )
  );
export async function execute(interaction) {
  try {
    let infoResult = await request("https://xkcd.com/info.0.json");
    let info = await infoResult.body.json();
    let comicNumber = "";

    // Determine which comic to get based on user input
    const requestedComic = interaction.options.getString("selection");
    if (requestedComic === "latest") comicNumber = info.num; // Get latest comic
    else if (parseInt(requestedComic))
      comicNumber = parseInt(requestedComic); // Get specific comic #
    else comicNumber = _getRandomIntInclusive(1, info.num); // Get a random comic

    // Retrieve the requested comic and build the reply
    let comicResult = await request(
      `https://xkcd.com/${comicNumber}/info.0.json`
    );
    let comicInfo = await comicResult.body.json();
    let replyContent = `#${comicInfo.num} \n${comicInfo.title}\n${comicInfo.img}\n${comicInfo.alt}`;

    return interaction.reply(replyContent);
  } catch (error) {
    console.log(`An error occurred in the xkcd command: ${error}`);
  }
}
