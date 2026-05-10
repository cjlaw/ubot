# AGENTS.md

## Commands

- Install dependencies: `npm install`
- Build: `npm run build` (compiles TypeScript to `dist/`)
- Run locally (quick): `npm run build && node dist/bot.js`
- Run locally (prod-faithful): `podman build -t ubot:local . && podman run --rm --env-file .env ubot:local`
- Register Discord slash commands: `npm run build && npm run dep-cmd`
- Run all tests: `npm test`
- Run one test file: `npm test -- test/name_test.js`
- Lint: `npx eslint .`
- Typecheck source: `npx tsc --noEmit`
- Typecheck tests: `npm run typecheck:test`
- Deploys are automatic on push to `main` (test → build image → push to GHCR → deploy via GitHub Actions) **only when deployable files change** (see positive list in `deploy.yml`'s `changes` job). Pushes touching only docs, tests, or workflows skip build/deploy but still run tests.
- **If you add a new top-level source file** (e.g. a new `utils.js` at the repo root), add it to the path filter regex in `.github/workflows/deploy.yml` → `changes` job → `filter` step, or it will never trigger a deploy.
- Manual redeploy on VM: `cd ~/ubot && docker compose pull && docker compose up -d`
- Container logs: `docker compose logs -f` (run from `~/ubot/` on the VM)
- Slash command registration runs automatically when `commands/` changes; trigger manually via `workflow_dispatch` on `register-commands.yml`
- Rollback: edit `docker-compose.yml` to pin `image:` to a previous `sha-<commit>` tag, then `docker compose up -d`

## Working Rules

- Use Node.js `>=22`; this project is ESM (`"type": "module"`).
- Keep runtime entry behavior in `bot.js`: it dynamically imports every `.js` file in `commands/` and stores commands by `command.data.name`.
- Add or update tests in `test/` when changing command or helper behavior.
- After adding, removing, renaming, or changing slash command definitions: locally run `npm run dep-cmd`; in production, pushing to `main` triggers the `register` job in `deploy.yml` automatically when `commands/` changed.
- Slash commands must export `data` as a Discord `SlashCommandBuilder` and `execute(interaction)` as the command handler.
- Commands that do async work should call `interaction.deferReply()` before the work and finish with `interaction.editReply()` to avoid Discord's interaction timeout.
- Keep `deploy-commands.js` separate from `bot.js`; it exists only to register slash commands with Discord's API.
- Do not require `ANTHROPIC_API_KEY` for basic bot startup; `/findepisode` should continue to fall back when the key is absent.
- `/findepisode` intentionally logs Discord usernames and raw query text for search diagnostics. Treat this as expected behavior, but avoid adding similar raw-input logs elsewhere without an explicit requirement.
- Do not ping users from facepalm responses; `facepalm_helper.js` intentionally uses display text instead of `<@userId>` mentions.

## Code Style & Conventions

- Follow `.eslintrc.json`.
- Use ESM `import`/`export`; include `.js` extensions in local imports.
- Use tabs for indentation.
- Use single quotes and semicolons.
- Prefer `const`; avoid `var`.
- Use named exports for helper functions.
- Keep helper logic testable without Discord network calls where practical.

## Project Structure Hints

- `bot.js`: entry point. Dynamically imports every `.js` file in `commands/` into a Collection keyed by `command.data.name`. Handles `InteractionCreate` (slash commands), `MessageReactionAdd` (emoji reactions), and `MessageCreate` (message mentions) events. Warms the episode cache at startup.
- `deploy-commands.js`: registers slash commands with Discord REST API. Intentionally separate from `bot.js`.
- `commands/`: slash command modules loaded automatically at runtime.
- `helpers/`:
  - `reaction_helper.js` — handles `upvote` and `twss` emoji reactions
  - `arnie_helper.js` — replies with Arnold Schwarzenegger quotes when "arnie" is mentioned; `sbfvgsArnie` emoji is resolved from the Discord client cache at startup and passed in
  - `facepalm_helper.js` — optionally replies to a specific user (gated by `facepalmEnabled`); uses display name instead of `<@userId>` intentionally
  - `timestamp_helper.js` — Discord timestamp format codes (`formats`) and `getOffsetMinutes` for IANA timezone → UTC offset conversion used by chrono-node
  - `episode_helper.js` — fetches and caches the SBFVGS RSS feed (24h TTL, warmed at startup), fuzzy-filters episodes, and calls Claude Haiku to pick the best match. `parseFeed` and `fuzzyFilter` are pure/tested; `searchEpisodes` requires network + API key.
- `test/`: Mocha/Chai tests for commands and helpers.
- `.env`: local runtime configuration:
  - `bot_token` — Discord bot token
  - `clientId` — Discord application/client ID
  - `guildId` — Discord guild ID (used by `dep-cmd` to register slash commands)
  - `facepalmEnabled` — optional; set to `"true"` to enable facepalm responses
  - `ANTHROPIC_API_KEY` — required for `/findepisode` smart search; falls back to fuzzy match if missing

**Dependencies of note:**

- `chrono-node` — natural language date parsing for `/timestamp` (e.g. "tomorrow at 5pm")
- `@anthropic-ai/sdk` — Anthropic API client used by `episode_helper.js` for LLM-powered episode matching
- `fast-xml-parser` — RSS feed parsing used by `episode_helper.js`

## Examples And Patterns

- Follow existing command files in `commands/` for the `data` plus `execute(interaction)` module shape.
- Follow existing helper tests in `test/*_test.js` when adding pure helper behavior.
- Keep RSS parsing and fuzzy filtering in `helpers/episode_helper.js` pure/testable; keep network and LLM orchestration separate.
- Avoid adding command files that depend on manual imports in `bot.js`; command discovery is directory-based.
- Avoid changing emoji names or environment variable names without updating all call sites and tests.

## Code review

## Code Review

For code review tasks:

- Follow `.ai/code_review.md`
- Read `.ai/reviews/current.md` before starting
- Write final review output to `.ai/reviews/current.md`
- Overwrite `.ai/reviews/current.md`
- Do not modify application/source files unless explicitly asked
- Do not report cosmetic/style-only issues
