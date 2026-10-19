import { expect } from "chai";
import { execute, _resetRateLimit } from "../commands/findepisode.js";
import { clearCache, _setAnthropicClient, _setFetch } from "../helpers/episode_helper.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type Anthropic from "@anthropic-ai/sdk";

// Command-level acceptance tests for #174: result embed links to sbfvgs.com, else the Megaphone player.

interface ItemSpec {
  title: string;
  description: string;
  pubDate?: string;
  episode?: number;
  adl: string;
}

const item = ({ title, description, pubDate, episode, adl }: ItemSpec): string => `
    <item>
      <title>${title}</title>
      <description>${description}</description>${pubDate !== undefined ? `
      <pubDate>${pubDate}</pubDate>` : ""}${episode !== undefined ? `
      <itunes:episode>${episode}</itunes:episode>` : ""}
      <enclosure url="https://pdcn.co/e/traffic.megaphone.fm/${adl}.mp3?updated=123" length="0" type="audio/mpeg"/>
    </item>`;

const feed = (...items: ItemSpec[]): string => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Test Podcast</title>
    <link>https://example.com</link>${items.map(item).join("")}
  </channel>
</rss>`;

// A standard episode shown alongside episodes expected to fall back to the player link,
// so an implementation that never emits sbfvgs.com links can't pass those tests.
const CONTROL_ITEM: ItemSpec = {
  title: "SBFVGS - Ep.203: Switch 2 - Electric Boogaloo!",
  description: "Nintendo has a new console.",
  pubDate: "Tue, 17 Jun 2025 13:00:00 -0000",
  episode: 203,
  adl: "ADL2030000000",
};
const CONTROL_URL = "https://sbfvgs.com/2025/06/17/sbfvgs-ep-203-switch-2-electric-boogaloo/";

const mockAnthropicPick = (indices: number[]) => ({
  messages: {
    create: async () => ({
      content: [{
        type: "tool_use",
        input: { indices },
      }],
    }),
  },
});

const mockInteraction = (query: string, userId = "acceptance-user") => {
  let reply: unknown = null;
  return {
    deferReply: async () => {},
    editReply: (content: unknown) => { reply = content; },
    getReply: () => reply,
    user: { id: userId },
    options: { getString: () => query },
  };
};

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// "[Listen](url)" — angle brackets around the URL (Discord's embed-suppression form) are tolerated.
const listenLinkRe = (url: string): RegExp => new RegExp(`\\[Listen\\]\\(<?${escapeRe(url)}>?\\)`);

const runWithFeed = async (xml: string, query: string, picks: number[] = [0]): Promise<string> => {
  _setFetch(() => Promise.resolve({ ok: true, text: () => Promise.resolve(xml) }) as unknown as ReturnType<typeof fetch>);
  _setAnthropicClient(mockAnthropicPick(picks) as unknown as Anthropic);
  const interaction = mockInteraction(query);
  await execute(interaction as unknown as ChatInputCommandInteraction);
  const reply = interaction.getReply() as { embeds: { data: { description: string } }[] };
  expect(reply, "reply").to.be.an("object");
  expect(reply.embeds, "embeds").to.have.length(1);
  return reply.embeds[0].data.description;
};

describe("#174 acceptance: /findepisode links to sbfvgs.com", () => {
  let originalApiKey: string | undefined;
  let originalFetch: typeof fetch;
  let globalFetchCalls: number;

  beforeEach(() => {
    clearCache();
    _resetRateLimit();
    originalApiKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "test-key";
    originalFetch = globalThis.fetch;
    globalFetchCalls = 0;
    globalThis.fetch = () => {
      globalFetchCalls++;
      return Promise.reject(new Error("network disabled in test"));
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    _setFetch((...args) => fetch(...args));
    _setAnthropicClient(null);
    clearCache();
    if (originalApiKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalApiKey;
  });

  it("A2: an episode with a pubDate links to its sbfvgs.com page and the Megaphone player link is absent", async () => {
    const description = await runWithFeed(feed({
      title: "SBFVGS - Ep.204: The Game Awards!",
      description: "The crew reacts to The Game Awards announcements.",
      pubDate: "Mon, 15 Dec 2025 13:00:00 -0000",
      episode: 204,
      adl: "ADL2040000000",
    }), "game awards");
    expect(description).to.match(listenLinkRe("https://sbfvgs.com/2025/12/15/sbfvgs-ep-204-the-game-awards/"));
    expect(description).to.not.include("playlist.megaphone.fm");
    expect(description).to.not.include("ADL2040000000");
  });

  it("A4: an episode with no <itunes:episode> links to its sbfvgs.com page", async () => {
    const description = await runWithFeed(feed({
      title: "SBFVGS - Ep.201: The End of the Console Wars",
      description: "Is the console war finally over?",
      pubDate: "Mon, 03 Mar 2025 13:00:00 -0000",
      adl: "ADL2010000000",
    }), "console wars");
    expect(description).to.match(listenLinkRe("https://sbfvgs.com/2025/03/03/sbfvgs-ep-201-the-end-of-the-console-wars/"));
    expect(description).to.not.include("playlist.megaphone.fm");
  });

  it("A8: the hand-edited-slug episode links to its override URL", async () => {
    const description = await runWithFeed(feed({
      title: "SBFVGS - Ep.91: Is the PlayStation 5 Right Around the Corner?",
      description: "Speculation about the next PlayStation.",
      pubDate: "Mon, 19 Mar 2018 08:00:00 -0000",
      episode: 91,
      adl: "ADL0910000000",
    }), "playstation corner");
    expect(description).to.match(listenLinkRe("https://sbfvgs.com/2018/03/19/sbfvgs-ep-91-is-the-ps5-right-around-the-corner/"));
    expect(description).to.not.include("playlist.megaphone.fm");
  });

  // Ep.182 has a page (posted a day after its feed date), so it links to its override URL.
  // The command-level fallback for a null override goes through the same `siteUrl ?? playerUrl`
  // path the A12 test below covers; A10 itself is tested at the helper level with a supplied
  // override map (test/episode_helper_acceptance_test.ts).
  it("A8: Ep.182 links to its 2021/12/19 override URL and its Megaphone player link is absent", async () => {
    const description = await runWithFeed(feed({
      title: "SBFVGS - Ep.182: A Very Super Best Friends Video Game Christmas VIII!",
      description: "The annual holiday special.",
      pubDate: "Sat, 18 Dec 2021 13:00:00 -0000",
      episode: 182,
      adl: "ADL1820000000",
    }, CONTROL_ITEM), "sbfvgs", [0, 1]);
    expect(description).to.match(listenLinkRe("https://sbfvgs.com/2021/12/19/sbfvgs-ep-182-a-very-super-best-friends-video-game-christmas-viii/"));
    expect(description).to.not.include("ADL1820000000");
    expect(description).to.match(listenLinkRe(CONTROL_URL));
  });

  it("A12: an episode with no pubDate falls back to its Megaphone player link", async () => {
    const description = await runWithFeed(feed({
      title: "SBFVGS - Ep.204: The Game Awards!",
      description: "The crew reacts to The Game Awards announcements.",
      episode: 204,
      adl: "ADL2049999999",
    }, CONTROL_ITEM), "sbfvgs", [0, 1]);
    expect(description).to.match(listenLinkRe("https://playlist.megaphone.fm/?e=ADL2049999999"));
    expect(description).to.not.include("sbfvgs-ep-204");
    expect(description).to.match(listenLinkRe(CONTROL_URL));
  });

  it("A13: with real network disabled, the command still produces the sbfvgs.com link and never calls global fetch", async () => {
    const description = await runWithFeed(feed({
      title: "SBFVGS - Ep.205: The Gaming Apocalypse",
      description: "Is gaming ending?",
      pubDate: "Mon, 20 Jul 2026 13:00:00 -0000",
      episode: 205,
      adl: "ADL2050000000",
    }), "gaming apocalypse");
    expect(description).to.match(listenLinkRe("https://sbfvgs.com/2026/07/20/sbfvgs-ep-205-the-gaming-apocalypse/"));
    expect(globalFetchCalls).to.equal(0);
  });
});
