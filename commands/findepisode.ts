import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { AutocompleteInteraction, ChatInputCommandInteraction } from "discord.js";
import { getEpisodes, fuzzyFilter, searchEpisodes } from "../helpers/episode_helper.js";
import type { Episode, EpisodeResult } from "../types.js";

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX = process.env.FINDEPISODE_RATE_LIMIT_MAX
  ? parseInt(process.env.FINDEPISODE_RATE_LIMIT_MAX, 10)
  : 5;
const userQueryTimes = new Map<string, number[]>();

// Test seams — not for production use.
export function _resetRateLimit(): void {
  userQueryTimes.clear();
}
export function _setRateLimitEntry(userId: string, timestamps: number[]): void {
  userQueryTimes.set(userId, timestamps);
}
export function _getRateLimitSize(): number {
  return userQueryTimes.size;
}

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const times = (userQueryTimes.get(userId) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS,
  );
  if (times.length === 0) userQueryTimes.delete(userId);
  if (times.length >= RATE_LIMIT_MAX) return true;
  times.push(now);
  userQueryTimes.set(userId, times);
  for (const [uid, ts] of userQueryTimes) {
    if (uid !== userId && !ts.some((t) => now - t < RATE_LIMIT_WINDOW_MS)) {
      userQueryTimes.delete(uid);
    }
  }
  return false;
}

export const data = new SlashCommandBuilder()
  .setName("findepisode")
  .setDescription(
    "Find an SBFVGS episode by topic, guest, game, or description",
  )
  .addStringOption((option) =>
    option
      .setName("query")
      .setDescription("Enter a topic, guest, game, or episode description")
      .setRequired(true)
      .setAutocomplete(true),
  );

function buildEpisodeEmbed(results: EpisodeResult[], query: string, fallback: boolean): EmbedBuilder {
  const titleQuery = query.length > 100 ? query.slice(0, 100) + "…" : query;
  const rawDescription = results
    .map(({ episode }, i) => {
      const rawTitle =
        episode.number != null
          ? `Ep. ${episode.number}: ${episode.title}`
          : episode.title;
      const epTitle =
        rawTitle.length > 200 ? rawTitle.slice(0, 199) + "…" : rawTitle;
      const desc =
        episode.description.length > 200
          ? episode.description.slice(0, 200) + "…"
          : episode.description;
      const date = episode.pubDate
        ? episode.pubDate.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : null;
      const header = date
        ? `**${i + 1}. ${epTitle}** — ${date}`
        : `**${i + 1}. ${epTitle}**`;
      return `${header}\n[Listen](${episode.playerUrl})\n${desc}`;
    })
    .join("\n\n");
  const description =
    rawDescription.length > 4096
      ? rawDescription.slice(0, 4095) + "…"
      : rawDescription;

  const embed = new EmbedBuilder()
    .setTitle(`Episode Search: "${titleQuery}"`)
    .setDescription(description)
    .setColor(0x5865f2);

  if (fallback)
    embed.setFooter({ text: "Fuzzy match (smart search unavailable)" });

  return embed;
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const query = interaction.options.getString("query", true);

  const shortcut = query.match(/^ep:(.+)$/);
  if (shortcut) {
    const episodes = await getEpisodes();
    const episode = episodes.find((ep) => ep.number != null && String(ep.number) === shortcut[1]);
    if (episode) {
      await interaction.editReply({ embeds: [buildEpisodeEmbed([{ episode }], query, false)] });
      return;
    }
  }

  if (query.trim().length < 3) {
    await interaction.editReply(
      "Please provide at least 3 characters to search.",
    );
    return;
  }

  if (isRateLimited(interaction.user.id)) {
    await interaction.editReply(
      "Slow down — you've used `/findepisode` too many times recently. Try again in a few minutes.",
    );
    return;
  }

  try {
    const result = await searchEpisodes(query, interaction.user.username);
    if (!result) {
      await interaction.editReply(
        "No matching episode found. Try a different description.",
      );
      return;
    }

    const { results, fallback } = result;
    await interaction.editReply({ embeds: [buildEpisodeEmbed(results, query, fallback)] });
  } catch (error) {
    console.error("findepisode error:", error);
    await interaction.editReply(
      "Sorry, episode search isn't working right now.",
    );
  }
}

export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused();
  // getEpisodes() can trigger a feed refetch (up to 10s) at the cache TTL boundary;
  // cap the wait so we always answer within Discord's 3s autocomplete deadline.
  const episodes = await Promise.race([
    getEpisodes(),
    new Promise<Episode[] | null>((resolve) => setTimeout(() => resolve(null), 2000)),
  ]);
  if (!episodes) {
    await interaction.respond([]);
    return;
  }
  const matches = focused.trim().length < 2
    ? episodes.slice(0, 25)
    : fuzzyFilter(episodes, focused, 25);
  const choices = matches
    .map((ep) => {
      const name = (ep.number != null ? `Ep. ${ep.number}: ${ep.title}` : ep.title).slice(0, 100);
      const value = ep.number != null ? `ep:${ep.number}` : ep.title.slice(0, 100);
      return { name, value };
    })
    .filter((choice) => choice.name.length > 0);
  await interaction.respond(choices);
}
