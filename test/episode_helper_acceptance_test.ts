import { expect } from "chai";
import {
  slugifyTitle,
  buildSiteUrl,
  parseFeed,
  _siteUrlOverrides,
  _setFetch,
} from "../helpers/episode_helper.js";

// Acceptance tests for #174: /findepisode links to the episode's sbfvgs.com page.

const SITE_URL_RE = /^https:\/\/sbfvgs\.com\/\d{4}\/\d{2}\/\d{2}\/[a-z0-9-]+\/$/;

const A8_TITLE = "SBFVGS - Ep.91: Is the PlayStation 5 Right Around the Corner?";
const A8_PUBDATE = "Mon, 19 Mar 2018 08:00:00 -0000";
const A8_URL = "https://sbfvgs.com/2018/03/19/sbfvgs-ep-91-is-the-ps5-right-around-the-corner/";

const A9_TITLE = "Super Best Friends Video Game Sleepover - Episode 6";
const A9_PUBDATE = "Mon, 15 Dec 2014 16:21:00 -0000";
const A9_URL = "https://sbfvgs.com/2014/12/15/super-best-friends-video-game-sleepover-episode-6-is-live/";

// Ep.182 has a page, posted one day after the feed's UTC date (2021-12-18), so it needs an override.
const EP182_TITLE = "SBFVGS - Ep.182: A Very Super Best Friends Video Game Christmas VIII!";
const EP182_PUBDATE = "Sat, 18 Dec 2021 13:00:00 -0000";
const EP182_URL = "https://sbfvgs.com/2021/12/19/sbfvgs-ep-182-a-very-super-best-friends-video-game-christmas-viii/";

// A10 fixture: a made-up episode that is NOT in the real feed. Tests override it to null
// ("no page") through a map they pass to parseFeed; it never belongs in the production table.
const A10_FIXTURE_TITLE = "SBFVGS - Ep.999: A Made-Up Episode With No Page";
const A10_FIXTURE_PUBDATE = "Wed, 01 Jan 2020 13:00:00 -0000";
const A10_FIXTURE_RULE_URL = "https://sbfvgs.com/2020/01/01/sbfvgs-ep-999-a-made-up-episode-with-no-page/";

// Overrides approved by the human on 2026-10-18 (decisions.md), keyed by exact feed title.
const APPROVED_OVERRIDES: [string, string][] = [
  [A8_TITLE, A8_URL],
  [A9_TITLE, A9_URL],
  [EP182_TITLE, EP182_URL],
  ["SBFVGS - Ep.166: Resident Evil Village Revealed!", "https://sbfvgs.com/2021/02/01/sbfvgs-ep-166-resident-evil-village-revealed/"],
  ["SBFVGS - Ep.159: Spooky Games We Will NEVER Play -with Gabe Patillo!", "https://sbfvgs.com/2020/10/27/sbfvgs-ep-159-spooky-games-we-will-never-play-with-gabe-patillo/"],
  ["SBFVGS - Uncharted 4 Spoilercast!", "https://sbfvgs.com/2016/07/18/sbfvgs-presents-the-uncharted-4-spoilercast/"],
  ["Super Best Friends Video Game Sleepover - Episode 1", "https://sbfvgs.com/2014/10/14/sbfvgs-podcast-episode-1-is-live/"],
];

interface ItemSpec {
  title: string; // already XML-escaped as it should appear in the feed
  pubDate?: string;
  episode?: number;
  adl: string;
}

const item = ({ title, pubDate, episode, adl }: ItemSpec): string => `
    <item>
      <title>${title}</title>
      <description>Episode description for ${adl}.</description>${pubDate !== undefined ? `
      <pubDate>${pubDate}</pubDate>` : ""}${episode !== undefined ? `
      <itunes:episode>${episode}</itunes:episode>` : ""}
      <enclosure url="https://pdcn.co/e/traffic.megaphone.fm/${adl}.mp3?updated=1" length="0" type="audio/mpeg"/>
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

// A standard episode appended to feeds whose subject expects siteUrl === null, so an
// implementation that always yields null can't pass those tests.
const CONTROL_ITEM: ItemSpec = {
  title: "SBFVGS - Ep.203: Switch 2 - Electric Boogaloo!",
  pubDate: "Tue, 17 Jun 2025 13:00:00 -0000",
  episode: 203,
  adl: "ADL2030000000",
};
const CONTROL_URL = "https://sbfvgs.com/2025/06/17/sbfvgs-ep-203-switch-2-electric-boogaloo/";

const utcNoon = (y: number, m: number, d: number): Date => new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

describe("#174 acceptance: sbfvgs.com episode links (helper)", () => {
  // Force a non-UTC local zone so that local-date vs UTC-date bugs surface.
  let originalTz: string | undefined;
  before(() => {
    originalTz = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
  });
  after(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  describe("slugifyTitle", () => {
    it("A2: slugifies a standard title (lowercase, punctuation runs to single '-', trimmed)", () => {
      expect(slugifyTitle("SBFVGS - Ep.204: The Game Awards!")).to.equal("sbfvgs-ep-204-the-game-awards");
    });

    it("A6: deletes straight apostrophes without leaving a stray hyphen", () => {
      expect(slugifyTitle("SBFVGS - Ep.192: Baldur's Great 3 - Delving Deep into Larian's Latest"))
        .to.equal("sbfvgs-ep-192-baldurs-great-3-delving-deep-into-larians-latest");
    });

    it("A6: deletes curly apostrophes (U+2019) without leaving a stray hyphen", () => {
      expect(slugifyTitle("SBFVGS - Ep.192: Baldur’s Great 3 - Delving Deep into Larian’s Latest"))
        .to.equal("sbfvgs-ep-192-baldurs-great-3-delving-deep-into-larians-latest");
    });

    it("A12: a title with no [a-z0-9] characters slugifies to an empty string", () => {
      expect(slugifyTitle("!!!")).to.equal("");
      expect(slugifyTitle("")).to.equal("");
      // control: a title with one alphanumeric survives
      expect(slugifyTitle("!!!a!!!")).to.equal("a");
    });
  });

  describe("buildSiteUrl (rule)", () => {
    it("A1: Ep.205 The Gaming Apocalypse, 2026-07-20", () => {
      expect(buildSiteUrl("SBFVGS - Ep.205: The Gaming Apocalypse", utcNoon(2026, 7, 20)))
        .to.equal("https://sbfvgs.com/2026/07/20/sbfvgs-ep-205-the-gaming-apocalypse/");
    });

    it("A2: Ep.204 The Game Awards!, 2025-12-15", () => {
      expect(buildSiteUrl("SBFVGS - Ep.204: The Game Awards!", utcNoon(2025, 12, 15)))
        .to.equal("https://sbfvgs.com/2025/12/15/sbfvgs-ep-204-the-game-awards/");
    });

    it("A3: Ep.203 Switch 2 - Electric Boogaloo!, 2025-06-17", () => {
      expect(buildSiteUrl("SBFVGS - Ep.203: Switch 2 - Electric Boogaloo!", utcNoon(2025, 6, 17)))
        .to.equal("https://sbfvgs.com/2025/06/17/sbfvgs-ep-203-switch-2-electric-boogaloo/");
    });

    it("A4: Ep.201 The End of the Console Wars, 2025-03-03 (zero-padded month/day)", () => {
      expect(buildSiteUrl("SBFVGS - Ep.201: The End of the Console Wars", utcNoon(2025, 3, 3)))
        .to.equal("https://sbfvgs.com/2025/03/03/sbfvgs-ep-201-the-end-of-the-console-wars/");
    });

    it("A5: uppercase 'EP.200' is lowercased, 2024-10-10", () => {
      expect(buildSiteUrl("SBFVGS - EP.200: The SBFVGS 200th Episode Spectacular!", utcNoon(2024, 10, 10)))
        .to.equal("https://sbfvgs.com/2024/10/10/sbfvgs-ep-200-the-sbfvgs-200th-episode-spectacular/");
    });

    it("A6: straight apostrophes produce no stray hyphen, 2023-08-21", () => {
      expect(buildSiteUrl("SBFVGS - Ep.192: Baldur's Great 3 - Delving Deep into Larian's Latest", utcNoon(2023, 8, 21)))
        .to.equal("https://sbfvgs.com/2023/08/21/sbfvgs-ep-192-baldurs-great-3-delving-deep-into-larians-latest/");
    });

    it("A6: curly apostrophes (U+2019) produce no stray hyphen, 2023-08-21", () => {
      expect(buildSiteUrl("SBFVGS - Ep.192: Baldur’s Great 3 - Delving Deep into Larian’s Latest", utcNoon(2023, 8, 21)))
        .to.equal("https://sbfvgs.com/2023/08/21/sbfvgs-ep-192-baldurs-great-3-delving-deep-into-larians-latest/");
    });

    it("A7: Sleepover-era title (non 'Ep.N:' pattern) still links, 2015-03-09", () => {
      expect(buildSiteUrl("Super Best Friends Video Game Sleepover - Episode 12", utcNoon(2015, 3, 9)))
        .to.equal("https://sbfvgs.com/2015/03/09/super-best-friends-video-game-sleepover-episode-12/");
    });

    it("A11: a new standard-pattern title not in any table gets a correct link", () => {
      expect(buildSiteUrl("SBFVGS - Ep.231: Something Nobody Has Heard Of Yet", utcNoon(2027, 1, 4)))
        .to.equal("https://sbfvgs.com/2027/01/04/sbfvgs-ep-231-something-nobody-has-heard-of-yet/");
    });

    it("UTC date: a negative-offset pubDate late in the local day uses the next UTC day", () => {
      const d = new Date("Mon, 20 Jul 2026 23:30:00 -0700");
      expect(buildSiteUrl("SBFVGS - Ep.205: The Gaming Apocalypse", d))
        .to.equal("https://sbfvgs.com/2026/07/21/sbfvgs-ep-205-the-gaming-apocalypse/");
    });

    it("UTC date: a positive-offset pubDate early in the local day uses the previous UTC day", () => {
      const d = new Date("Tue, 21 Jul 2026 00:30:00 +0200");
      expect(buildSiteUrl("SBFVGS - Ep.205: The Gaming Apocalypse", d))
        .to.equal("https://sbfvgs.com/2026/07/20/sbfvgs-ep-205-the-gaming-apocalypse/");
    });

    it("UTC date: an instant just after UTC midnight uses that UTC day even when local time is the previous day", () => {
      // 2025-12-15T00:30Z is 2025-12-14 16:30 in America/Los_Angeles.
      const d = new Date(Date.UTC(2025, 11, 15, 0, 30, 0));
      expect(buildSiteUrl("SBFVGS - Ep.204: The Game Awards!", d))
        .to.equal("https://sbfvgs.com/2025/12/15/sbfvgs-ep-204-the-game-awards/");
    });

    // Each A12 case is paired with a positive control so a function that always returns null can't pass.
    const A2_CONTROL = "https://sbfvgs.com/2025/12/15/sbfvgs-ep-204-the-game-awards/";

    it("A12: null pubDate returns null", () => {
      expect(buildSiteUrl("SBFVGS - Ep.204: The Game Awards!", null)).to.equal(null);
      expect(buildSiteUrl("SBFVGS - Ep.204: The Game Awards!", utcNoon(2025, 12, 15))).to.equal(A2_CONTROL);
    });

    it("A12: an invalid Date returns null", () => {
      expect(buildSiteUrl("SBFVGS - Ep.204: The Game Awards!", new Date("not a date"))).to.equal(null);
      expect(buildSiteUrl("SBFVGS - Ep.204: The Game Awards!", utcNoon(2025, 12, 15))).to.equal(A2_CONTROL);
    });

    it("A12: an empty title returns null", () => {
      expect(buildSiteUrl("", utcNoon(2025, 12, 15))).to.equal(null);
      expect(buildSiteUrl("SBFVGS - Ep.204: The Game Awards!", utcNoon(2025, 12, 15))).to.equal(A2_CONTROL);
    });

    it("A12: a title that slugifies to empty ('!!!') returns null", () => {
      expect(buildSiteUrl("!!!", utcNoon(2025, 12, 15))).to.equal(null);
      expect(buildSiteUrl("SBFVGS - Ep.204: The Game Awards!", utcNoon(2025, 12, 15))).to.equal(A2_CONTROL);
    });
  });

  describe("parseFeed siteUrl", () => {
    it("A2: a standard episode in the feed gets its sbfvgs.com siteUrl; playerUrl/audioUrl unchanged", () => {
      const [ep] = parseFeed(feed({
        title: "SBFVGS - Ep.204: The Game Awards!",
        pubDate: "Mon, 15 Dec 2025 13:00:00 -0000",
        episode: 204,
        adl: "ADL1111111111",
      }));
      expect(ep.siteUrl).to.equal("https://sbfvgs.com/2025/12/15/sbfvgs-ep-204-the-game-awards/");
      expect(ep.playerUrl).to.equal("https://playlist.megaphone.fm/?e=ADL1111111111");
      expect(ep.audioUrl).to.include("ADL1111111111.mp3");
    });

    it("A4: an episode with no <itunes:episode> still gets its siteUrl", () => {
      const [ep] = parseFeed(feed({
        title: "SBFVGS - Ep.201: The End of the Console Wars",
        pubDate: "Mon, 03 Mar 2025 13:00:00 -0000",
        adl: "ADL2222222222",
      }));
      expect(ep.siteUrl).to.equal("https://sbfvgs.com/2025/03/03/sbfvgs-ep-201-the-end-of-the-console-wars/");
    });

    it("A6: an entity-encoded apostrophe (&apos;) in the feed XML produces no stray hyphen", () => {
      const [ep] = parseFeed(feed({
        title: "SBFVGS - Ep.192: Baldur&apos;s Great 3 - Delving Deep into Larian&apos;s Latest",
        pubDate: "Mon, 21 Aug 2023 13:00:00 -0000",
        episode: 192,
        adl: "ADL3333333333",
      }));
      expect(ep.siteUrl).to.equal("https://sbfvgs.com/2023/08/21/sbfvgs-ep-192-baldurs-great-3-delving-deep-into-larians-latest/");
    });

    it("A6: a raw curly apostrophe in the feed XML produces no stray hyphen", () => {
      const [ep] = parseFeed(feed({
        title: "SBFVGS - Ep.192: Baldur’s Great 3 - Delving Deep into Larian’s Latest",
        pubDate: "Mon, 21 Aug 2023 13:00:00 -0000",
        episode: 192,
        adl: "ADL3333333334",
      }));
      expect(ep.siteUrl).to.equal("https://sbfvgs.com/2023/08/21/sbfvgs-ep-192-baldurs-great-3-delving-deep-into-larians-latest/");
    });

    it("A7: a Sleepover-era episode in the feed gets its siteUrl built from title and date", () => {
      const [ep] = parseFeed(feed({
        title: "Super Best Friends Video Game Sleepover - Episode 12",
        pubDate: "Mon, 09 Mar 2015 16:00:00 -0000",
        adl: "ADL4444444444",
      }));
      expect(ep.siteUrl).to.equal("https://sbfvgs.com/2015/03/09/super-best-friends-video-game-sleepover-episode-12/");
    });

    it("A8: Ep.91 (hand-edited slug) uses the override URL", () => {
      const [ep] = parseFeed(feed({ title: A8_TITLE, pubDate: A8_PUBDATE, episode: 91, adl: "ADL5555555555" }));
      expect(ep.siteUrl).to.equal(A8_URL);
    });

    it("A9: Sleepover Episode 6 ('-is-live' suffix) uses the override URL", () => {
      const [ep] = parseFeed(feed({ title: A9_TITLE, pubDate: A9_PUBDATE, adl: "ADL6666666666" }));
      expect(ep.siteUrl).to.equal(A9_URL);
    });

    it("A8: Ep.182 (posted a day after its feed date) uses the 2021/12/19 override URL from the default table", () => {
      const [ep] = parseFeed(feed({ title: EP182_TITLE, pubDate: EP182_PUBDATE, episode: 182, adl: "ADL7777777777" }));
      expect(ep.siteUrl).to.equal(EP182_URL);
      expect(ep.playerUrl).to.equal("https://playlist.megaphone.fm/?e=ADL7777777777");
    });

    it("A10: an episode overridden to null (no page) via a supplied override map has siteUrl null and keeps its Megaphone playerUrl", () => {
      expect(_siteUrlOverrides.has(A10_FIXTURE_TITLE), "fixture must not be in the production table").to.equal(false);
      const fixture: ItemSpec = { title: A10_FIXTURE_TITLE, pubDate: A10_FIXTURE_PUBDATE, episode: 999, adl: "ADL7777777778" };

      const [ep, control] = parseFeed(feed(fixture, CONTROL_ITEM), new Map([[A10_FIXTURE_TITLE, null]]));
      expect(ep.siteUrl).to.equal(null);
      expect(ep.playerUrl).to.equal("https://playlist.megaphone.fm/?e=ADL7777777778");
      expect(control.siteUrl).to.equal(CONTROL_URL);

      // Positive control: without the supplied map the same item gets its rule URL,
      // so the null above came from the override.
      const [plain] = parseFeed(feed(fixture));
      expect(plain.siteUrl).to.equal(A10_FIXTURE_RULE_URL);
    });

    it("parseFeed overrides param: a supplied map's URL is honoured and replaces the production table for that call", () => {
      const customUrl = "https://sbfvgs.com/2020/01/02/a-custom-page-for-the-fixture/";
      const [ep, a8] = parseFeed(
        feed(
          { title: A10_FIXTURE_TITLE, pubDate: A10_FIXTURE_PUBDATE, episode: 999, adl: "ADL7777777779" },
          { title: A8_TITLE, pubDate: A8_PUBDATE, episode: 91, adl: "ADL5555555556" },
        ),
        new Map([[A10_FIXTURE_TITLE, customUrl]]),
      );
      expect(ep.siteUrl).to.equal(customUrl);
      // A8 is not in the supplied map, so the slug rule applies instead of the production override.
      expect(a8.siteUrl).to.equal("https://sbfvgs.com/2018/03/19/sbfvgs-ep-91-is-the-playstation-5-right-around-the-corner/");
    });

    it("A11: a new standard-pattern episode not in the override table gets a correct link", () => {
      const title = "SBFVGS - Ep.231: Something Nobody Has Heard Of Yet";
      expect(_siteUrlOverrides.has(title)).to.equal(false);
      const [ep] = parseFeed(feed({
        title,
        pubDate: "Mon, 04 Jan 2027 13:00:00 -0000",
        episode: 231,
        adl: "ADL8888888888",
      }));
      expect(ep.siteUrl).to.equal("https://sbfvgs.com/2027/01/04/sbfvgs-ep-231-something-nobody-has-heard-of-yet/");
    });

    it("A12: an episode with no <pubDate> has siteUrl null and keeps its Megaphone playerUrl", () => {
      const [ep, control] = parseFeed(feed({
        title: "SBFVGS - Ep.204: The Game Awards!",
        episode: 204,
        adl: "ADL9999999999",
      }, CONTROL_ITEM));
      expect(ep.siteUrl).to.equal(null);
      expect(ep.playerUrl).to.equal("https://playlist.megaphone.fm/?e=ADL9999999999");
      expect(control.siteUrl).to.equal(CONTROL_URL);
    });

    it("A12: an episode with an unparseable <pubDate> has siteUrl null", () => {
      const [ep, control] = parseFeed(feed({
        title: "SBFVGS - Ep.204: The Game Awards!",
        pubDate: "sometime last winter",
        episode: 204,
        adl: "ADL9999999998",
      }, CONTROL_ITEM));
      expect(ep.siteUrl).to.equal(null);
      expect(ep.playerUrl).to.equal("https://playlist.megaphone.fm/?e=ADL9999999998");
      expect(control.siteUrl).to.equal(CONTROL_URL);
    });

    it("A12: an episode whose title slugifies to empty has siteUrl null", () => {
      const [ep, control] = parseFeed(feed({
        title: "!!!",
        pubDate: "Mon, 15 Dec 2025 13:00:00 -0000",
        adl: "ADL9999999997",
      }, CONTROL_ITEM));
      expect(ep.siteUrl).to.equal(null);
      expect(ep.playerUrl).to.equal("https://playlist.megaphone.fm/?e=ADL9999999997");
      expect(control.siteUrl).to.equal(CONTROL_URL);
    });

    it("UTC date: parseFeed uses the UTC date of a negative-offset pubDate", () => {
      const [ep] = parseFeed(feed({
        title: "SBFVGS - Ep.205: The Gaming Apocalypse",
        pubDate: "Mon, 20 Jul 2026 23:30:00 -0700",
        episode: 205,
        adl: "ADL1212121212",
      }));
      expect(ep.siteUrl).to.equal("https://sbfvgs.com/2026/07/21/sbfvgs-ep-205-the-gaming-apocalypse/");
    });
  });

  describe("A13: offline / static override table", () => {
    let originalFetch: typeof fetch;
    let globalFetchCalls: number;
    let seamFetchCalls: number;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
      globalFetchCalls = 0;
      seamFetchCalls = 0;
      globalThis.fetch = () => {
        globalFetchCalls++;
        return Promise.reject(new Error("network disabled in test"));
      };
      _setFetch(() => {
        seamFetchCalls++;
        return Promise.reject(new Error("network disabled in test"));
      });
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
      _setFetch((...args) => fetch(...args));
    });

    it("A13: with all network disabled, parseFeed synchronously produces correct links for every episode in a mixed feed", () => {
      const result = parseFeed(feed(
        { title: "SBFVGS - Ep.205: The Gaming Apocalypse", pubDate: "Mon, 20 Jul 2026 13:00:00 -0000", episode: 205, adl: "ADL0000000205" },
        { title: "SBFVGS - Ep.201: The End of the Console Wars", pubDate: "Mon, 03 Mar 2025 13:00:00 -0000", adl: "ADL0000000201" },
        { title: EP182_TITLE, pubDate: EP182_PUBDATE, episode: 182, adl: "ADL0000000182" },
        { title: A8_TITLE, pubDate: A8_PUBDATE, episode: 91, adl: "ADL0000000091" },
        { title: "Super Best Friends Video Game Sleepover - Episode 12", pubDate: "Mon, 09 Mar 2015 16:00:00 -0000", adl: "ADL0000000012" },
        { title: A9_TITLE, pubDate: A9_PUBDATE, adl: "ADL0000000006" },
      ));
      expect(result).to.not.be.instanceOf(Promise);
      expect(result.map((e) => e.siteUrl)).to.deep.equal([
        "https://sbfvgs.com/2026/07/20/sbfvgs-ep-205-the-gaming-apocalypse/",
        "https://sbfvgs.com/2025/03/03/sbfvgs-ep-201-the-end-of-the-console-wars/",
        EP182_URL,
        A8_URL,
        "https://sbfvgs.com/2015/03/09/super-best-friends-video-game-sleepover-episode-12/",
        A9_URL,
      ]);
    });

    it("[negative] A13: parseFeed makes no network request (global fetch and the fetch seam are never called)", async () => {
      parseFeed(feed(
        { title: "SBFVGS - Ep.204: The Game Awards!", pubDate: "Mon, 15 Dec 2025 13:00:00 -0000", episode: 204, adl: "ADL0000000204" },
        { title: A8_TITLE, pubDate: A8_PUBDATE, episode: 91, adl: "ADL0000000091" },
      ));
      // Let any fire-and-forget request get scheduled before checking.
      await new Promise((resolve) => setImmediate(resolve));
      expect(globalFetchCalls).to.equal(0);
      expect(seamFetchCalls).to.equal(0);
    });

    it("A13: the override table contains A8, A9, Ep.182 and the other approved overrides with their exact URLs", () => {
      for (const [title, url] of APPROVED_OVERRIDES) {
        expect(_siteUrlOverrides.get(title), `override for ${title}`).to.equal(url);
      }
    });

    it("A13: the production override table has no null entries (every value is a well-formed sbfvgs.com URL)", () => {
      expect(_siteUrlOverrides.size).to.be.greaterThan(0);
      for (const [title, url] of _siteUrlOverrides) {
        expect(url, `override for ${title}`).to.be.a("string").and.match(SITE_URL_RE);
      }
    });

    it("A13: every override value is null or a well-formed sbfvgs.com episode URL", () => {
      expect(_siteUrlOverrides.size).to.be.greaterThan(0);
      for (const [title, url] of _siteUrlOverrides) {
        expect(title, "override key").to.be.a("string").and.not.equal("");
        if (url !== null) {
          expect(url, `override for ${title}`).to.match(SITE_URL_RE);
        }
      }
    });
  });
});
