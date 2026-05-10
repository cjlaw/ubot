# ubot

A Discord bot for the SBFVGS gaming community server. Built with [Discord.js v14](https://discord.js.org) and TypeScript (Node 22, ESM).

## Slash commands

| Command | Description |
|---|---|
| `/ping` | Replies with Pong! |
| `/joke` | Fetches a random dad joke |
| `/xkcd [selection]` | Fetches an xkcd comic — `"latest"`, `"random"`, or a specific number (default: random) |
| `/timestamp <input> <timezone>` | Generates Discord timestamp tags from natural language input (e.g. "tomorrow at 5pm", "in 5 hours") — reply is ephemeral |
| `/findepisode <query>` | Searches SBFVGS podcast episodes by topic, guest, game, or description — LLM-powered when `ANTHROPIC_API_KEY` is set, fuzzy match fallback otherwise |

## Bot behaviors

- **`upvote` reaction** — posts a public "received an upvote from" message in the channel
- **`twss` reaction** — posts a public "said X to Y" message in the channel
- **Arnie mentions** — replies with an Arnold Schwarzenegger quote when `Arnie` or `Arnold` appears in a message (suppressed if the message already contains the Arnie emoji)
- **Facepalm** — optionally replies to a specific user; enabled via `facepalmEnabled=true`

## Prerequisites

- Node.js 22 (`node --version` should be `v22.x.x`)
- A Discord bot application: [Discord Developer Portal](https://discord.com/developers/applications)

## Local setup

1. `npm install`
2. Create `.env` at the repo root:
   ```
   bot_token=                 # Discord bot token (required)
   clientId=                  # Discord application/client ID (required)
   guildId=                   # Discord guild ID — used by dep-cmd to register commands (required)
   facepalmEnabled=           # optional; set to "true" to enable facepalm responses
   ANTHROPIC_API_KEY=         # optional; required for smart episode matching in /findepisode
   FINDEPISODE_RATE_LIMIT_MAX= # optional; max /findepisode uses per user per 10 min (default: 5)
   ```
3. `npm run build` — compiles TypeScript to `dist/`
4. `npm run dep-cmd` — registers slash commands with Discord (required on first run and after adding, removing, renaming, or changing slash command definitions)
5. `node dist/bot.js`

### Prod-faithful local run (via Podman)

```sh
podman build -t ubot:local . && podman run --rm -it --env-file .env ubot:local
```

## Tests

```sh
npm test                            # run all tests
npm test -- test/name_test.ts       # run one test file
```

## Deployment

Deploys automatically on push to `main` via GitHub Actions, but only when deployable files change. Pushes touching only docs, tests, or workflows skip build/deploy but still run tests.

The image is pushed to GHCR (`ghcr.io/cjlaw/ubot`) and pulled to the VM by the deploy job. Slash commands are automatically re-registered when `commands/` changes; trigger manually via `workflow_dispatch` on `register-commands.yml`.

**Rollback:** edit `docker-compose.yml` to pin `image:` to a `sha-<commit>` tag, then `docker compose up -d` on the VM.

## Resources

- [Discord.js guide](https://discordjs.guide/)
- [Discord Developer Portal](https://discord.com/developers/applications)
