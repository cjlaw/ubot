const { SlashCommandBuilder } = require("discord.js");
const { request } = require("undici");
const headers = {
  Accept: "application/json",
  "X-API-Key": "4526f02876ba4fbc92883d3eb732a955",
};
module.exports = {
  data: new SlashCommandBuilder()
    .setName("twod")
    .setDescription("calculates how much time has been wasted on destiny")
    .addStringOption((option) =>
      option
        .setName("platform")
        .setDescription("use 'ps' or 'xbox'")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option.setName("username").setDescription("username").setRequired(true)
    ),
  async execute(interaction) {
    try {
      await interaction.deferReply();
      const username = interaction.options
        .getString("username")
        .match(/\b(?:\W|[0-9])*(\w+)\b/)[0];
      const platformParam = interaction.options.getString("platform");

      /*
        https://bungie-net.github.io/multi/schema_BungieMembershipType.html

        TigerXbox: 1
        TigerPsn: 2
        TigerSteam: 3
        TigerBlizzard: 4
        TigerStadia: 5
        TigerEgs: 6
      */

      let device = 2; // Default to PS
      if (platformParam.toLowerCase().search("xbox") !== -1) device = 1;

      let membershipUrl = `https://www.bungie.net/d1/platform/Destiny/${device}/Stats/GetMembershipIdByDisplayName/${username}/`;

      let membershipResult = await request(encodeURI(membershipUrl), {
        headers: headers,
      });
      let membershipInfo = await membershipResult.body.json();
      if (membershipInfo.Response == "0")
        throw Error(`Error retrieving membership info`);

      let accountUrl = `https://www.bungie.net/platform/Destiny2/${device}/Account/${membershipInfo.Response}/Stats/`;
      let accountResult = await request(encodeURI(accountUrl), {
        headers: headers,
      });
      let accountInfo = await accountResult.body.json();
      let secondsPlayed =
        accountInfo?.Response?.mergedAllCharacters?.results?.allPvE?.allTime
          ?.secondsPlayed?.basic?.value;
      if (!secondsPlayed)
        throw Error(`Error retrieving seconds played from the account info`);
      let hoursPlayed = Math.floor(secondsPlayed / 3600);

      let returnMessage = `${username} has wasted over ${hoursPlayed} hours playing Destiny 2!`;

      await interaction.editReply(returnMessage);
    } catch (error) {
      console.log(`Error in twod command: ${JSON.stringify(error)}`);
      await interaction.editReply(`Sorry, an error has occurred :(`);
    }
  },
};
