# local development

**Requires Node.js >=22.**

1. npm install
2. Create your own Discord bot and make it a bot user, and get a valid token. Here's a guide: https://github.com/reactiflux/discord-irc/wiki/Creating-a-discord-bot-&-getting-a-token
3. Create a `.env` file at the root of your repo with the following:
    ```
    bot_token=
    clientId=
    guildId=
    facepalmEnabled=   # optional, set to "true" to enable facepalm responses
    ANTHROPIC_API_KEY= # optional, required for smart episode matching in /findepisode
    ```
4. npm run dep-cmd
5. node bot.js

## tests
`npm test` - Run all tests

`npm test -- test/name_test.js` - Run a specified test

# resources
https://discordjs.guide/
