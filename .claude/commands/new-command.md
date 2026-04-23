Create a new Discord slash command for ubot.

Ask the user for:
1. The command name (lowercase, no spaces)
2. A short description of what it does
3. Any options/arguments the command takes

Then create two files:

**`commands/<name>.js`** following this pattern exactly:
- Import `SlashCommandBuilder` from `discord.js` and any other dependencies needed
- Export `data` as a `SlashCommandBuilder` with the name, description, and any options
- Export `execute(interaction)` as an async function that:
  - Calls `await interaction.deferReply()` first, before any async work
  - Does its work
  - Calls `await interaction.editReply(result)` to respond
  - Has a try/catch that calls `await interaction.editReply("Sorry, an error has occurred :(")` on failure and logs the error with `console.error`

**`test/<name>_test.js`** following this pattern:
- Use a `mockInteraction` factory function that tracks the reply via `editReply`, includes a no-op `deferReply`, and exposes a `getReply()` method
- Test the happy path at minimum
- Import with named imports from the command file

After creating both files, remind the user to run `npm run dep-cmd` to register the new command with Discord.
