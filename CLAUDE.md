# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Production

The bot runs under pm2 with the name `ubot`:
```bash
pm2 start bot.js --name ubot
pm2 restart ubot
pm2 logs ubot
```

Requires Node.js >=22. The `libatomic1` system library must also be present (`sudo apt-get install libatomic1` on Debian/Ubuntu). After deploying, run `npm install` before restarting.

## Commands

```bash
npm install           # install dependencies
node bot.js           # run the bot
npm run dep-cmd       # register slash commands with Discord (run after adding/changing commands)
npm test              # run all tests
npm test -- test/name_test.js  # run a single test file
```

## Environment Setup

Create a `.env` file at the repo root with:
```
bot_token=
clientId=
guildId=
facepalmEnabled=   # optional, set to "true" to enable facepalm responses
```

`npm run dep-cmd` must be re-run whenever slash commands are added or their definitions change — this registers them with the Discord guild specified by `guildId`.

## Architecture

The bot is an ESM project (`"type": "module"` in package.json).

**bot.js** is the entry point. It:
1. Dynamically imports every `.js` file in `commands/` and stores them in a Discord.js `Collection` keyed by command name
2. Handles `InteractionCreate` (slash commands), `MessageReactionAdd` (emoji reactions), and `MessageCreate` (message mentions) events

**Commands** (`commands/`) each export a `data` (SlashCommandBuilder) and an `execute(interaction)` function. Adding a file here is enough to register it at runtime; `dep-cmd` registers it with Discord's API. Commands must call `interaction.deferReply()` before any async work, then `interaction.editReply()` to respond — this avoids Discord's 3-second interaction timeout.

**Helpers** (`helpers/`) export plain named functions for message/reaction handling, called directly in `bot.js` event handlers, plus shared utilities used by commands:
- `reaction_helper.js` — handles `upvote` and `twss` emoji reactions
- `arnie_helper.js` — replies with Arnold Schwarzenegger quotes when "arnie" is mentioned. The emoji is resolved by name (`sbfvgsArnie`) from the Discord client cache at startup and passed into the helper
- `facepalm_helper.js` — optionally replies to a specific user (gated by `facepalmEnabled` env var). Uses a plain display name rather than a `<@userId>` mention intentionally — it reads like a user reacted without pinging them
- `timestamp_helper.js` — shared constants and utilities for `timestamp.js`: Discord timestamp format codes (`formats`) and `getOffsetMinutes` for converting IANA timezone names to UTC offset minutes (used by chrono-node for timezone-aware parsing)

**Dependencies of note:**
- `chrono-node` — natural language date parsing used by `timestamp.js` (e.g. "tomorrow at 5pm", "in 5 hours")

**deploy-commands.js** registers slash commands with Discord's API and is intentionally separate from the main bot.
