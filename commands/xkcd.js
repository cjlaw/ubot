import { SlashCommandBuilder } from "discord.js";

const getRandomIntInclusive = (min, max) => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
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
  await interaction.deferReply();
  try {
    const info = await fetch("https://xkcd.com/info.0.json").then((r) => r.json());

    const requestedComic = interaction.options.getString("selection");
    let comicNumber;
    if (requestedComic === "latest") comicNumber = info.num;
    else if (parseInt(requestedComic, 10)) comicNumber = parseInt(requestedComic, 10);
    else comicNumber = getRandomIntInclusive(1, info.num);

    const comicInfo = await fetch(`https://xkcd.com/${comicNumber}/info.0.json`).then((r) => r.json());
    const replyContent = `#${comicInfo.num} \n${comicInfo.title}\n${comicInfo.img}\n${comicInfo.alt}`;

    await interaction.editReply(replyContent);
  } catch (error) {
    console.error(`An error occurred in the xkcd command: ${error}`);
    await interaction.editReply("Sorry, I couldn't fetch a comic right now :(");
  }
}
