# local development
1. npm install
2. create your own discord bot and make it a bot user, and get a valid token.   Here's a guide: ~~http://discord.kongslien.net/guide.html~~ https://github.com/reactiflux/discord-irc/wiki/Creating-a-discord-bot-&-getting-a-token
3. create a ```.env``` file at the root of your repo:
file should have the following:  
    bot_token
    botenv
    clientId
    guildId

4. npm run dep-cmd
5. node bot.js

## tests
`npm run test` - Run all tests

`npm run test -- test/name_test.js` - Run a specified test


# resources
https://discordjs.guide/