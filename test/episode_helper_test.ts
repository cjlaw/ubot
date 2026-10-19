import { expect } from "chai";
import { parseFeed, fuzzyFilter, clearCache, slugifyTitle, buildSiteUrl, _siteUrlOverrides } from "../helpers/episode_helper.js";
import type { Episode } from "../types.js";

const FIXTURE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Test Podcast</title>
    <link>https://example.com</link>
    <item>
      <title>SBFVGS - Ep.10: Hades Interview</title>
      <description><![CDATA[<p>Adam and Mike sit down with <b>Greg Kasavin</b> from Supergiant Games to talk about Hades.</p>]]></description>
      <itunes:episode>10</itunes:episode>
      <enclosure url="https://pdcn.co/e/traffic.megaphone.fm/ADL1234567890.mp3?updated=123" length="0" type="audio/mpeg"/>
    </item>
    <item>
      <title>SBFVGS - Ep.9: GOTY Discussion</title>
      <description>The crew picks their game of the year winners for sbfvgsgoty.</description>
      <itunes:episode>9</itunes:episode>
      <enclosure url="https://pdcn.co/e/traffic.megaphone.fm/ADL9876543210.mp3?updated=456" length="0" type="audio/mpeg"/>
    </item>
    <item>
      <title>SBFVGS - Ep.8: No ADL ID Episode</title>
      <description>An episode with no recognizable ADL ID in the enclosure.</description>
      <itunes:episode>8</itunes:episode>
      <enclosure url="https://other-host.com/audio.mp3" length="0" type="audio/mpeg"/>
    </item>
  </channel>
</rss>`;

describe("#parseFeed", () => {
  it("does not throw on a numeric title and builds a siteUrl", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>Test Podcast</title>
    <item>
      <title>2024</title>
      <pubDate>Mon, 15 Jan 2024 10:00:00 GMT</pubDate>
      <description>Numeric title.</description>
      <itunes:episode>1</itunes:episode>
      <enclosure url="https://other-host.com/audio.mp3" length="0" type="audio/mpeg"/>
    </item>
  </channel>
</rss>`;
    const episodes = parseFeed(xml);
    expect(episodes[0].siteUrl).to.equal("https://sbfvgs.com/2024/01/15/2024/");
  });

  it("extracts episode number, title, and stripped description", () => {
    const episodes = parseFeed(FIXTURE_XML);
    expect(episodes[0].number).to.equal(10);
    expect(episodes[0].title).to.equal("SBFVGS - Ep.10: Hades Interview");
    expect(episodes[0].description).to.equal("Adam and Mike sit down with Greg Kasavin from Supergiant Games to talk about Hades.");
  });

  it("builds Megaphone player URL from ADL ID in enclosure", () => {
    const episodes = parseFeed(FIXTURE_XML);
    expect(episodes[0].playerUrl).to.equal("https://playlist.megaphone.fm/?e=ADL1234567890");
    expect(episodes[1].playerUrl).to.equal("https://playlist.megaphone.fm/?e=ADL9876543210");
  });

  it("falls back to sbfvgs.com when enclosure has no ADL ID", () => {
    const episodes = parseFeed(FIXTURE_XML);
    expect(episodes[2].playerUrl).to.equal("https://sbfvgs.com");
  });

  it("strips HTML tags from description", () => {
    const episodes = parseFeed(FIXTURE_XML);
    expect(episodes[0].description).to.not.include("<p>");
    expect(episodes[0].description).to.not.include("<b>");
  });

  it("handles a single-item feed without crashing", () => {
    const singleItemXml = FIXTURE_XML.replace(
      /(<item>[\s\S]*?<\/item>)([\s\S]*)/,
      "$1\n  </channel>\n</rss>"
    );
    const episodes = parseFeed(singleItemXml);
    expect(episodes).to.have.length(1);
    expect(episodes[0].number).to.equal(10);
  });

  it("throws on non-RSS XML (e.g. Atom feed)", () => {
    const atomXml = `<?xml version="1.0"?><feed><entry><title>x</title></entry></feed>`;
    expect(() => parseFeed(atomXml)).to.throw("Invalid or empty RSS feed");
  });

  it("throws when channel has no items", () => {
    const emptyChannelXml = `<?xml version="1.0"?><rss version="2.0"><channel><title>empty</title></channel></rss>`;
    expect(() => parseFeed(emptyChannelXml)).to.throw("Invalid or empty RSS feed");
  });
});

describe("#slugifyTitle / #buildSiteUrl", () => {
  const cases: [string, string, string][] = [
    ["A1", "SBFVGS - Ep.205: The Gaming Apocalypse", "https://sbfvgs.com/2026/07/20/sbfvgs-ep-205-the-gaming-apocalypse/"],
    ["A2", "SBFVGS - Ep.204: The Game Awards!", "https://sbfvgs.com/2025/12/15/sbfvgs-ep-204-the-game-awards/"],
    ["A3", "SBFVGS - Ep.203: Switch 2 - Electric Boogaloo!", "https://sbfvgs.com/2025/06/17/sbfvgs-ep-203-switch-2-electric-boogaloo/"],
    ["A5", "SBFVGS - EP.200: The SBFVGS 200th Episode Spectacular!", "https://sbfvgs.com/2024/10/10/sbfvgs-ep-200-the-sbfvgs-200th-episode-spectacular/"],
    ["A6", "SBFVGS - Ep.192: Baldur's Great 3 - Delving Deep into Larian's Latest", "https://sbfvgs.com/2023/08/21/sbfvgs-ep-192-baldurs-great-3-delving-deep-into-larians-latest/"],
    ["A7", "Super Best Friends Video Game Sleepover - Episode 12", "https://sbfvgs.com/2015/03/09/super-best-friends-video-game-sleepover-episode-12/"],
  ];
  const dates: Record<string, string> = {
    A1: "2026-07-20T12:00:00Z",
    A2: "2025-12-15T12:00:00Z",
    A3: "2025-06-17T12:00:00Z",
    A5: "2024-10-10T12:00:00Z",
    A6: "2023-08-21T12:00:00Z",
    A7: "2015-03-09T12:00:00Z",
  };

  for (const [id, title, url] of cases) {
    it(`${id}: builds ${url}`, () => {
      expect(buildSiteUrl(title, new Date(dates[id]))).to.equal(url);
    });
  }

  it("slugifyTitle drops straight and curly apostrophes without a stray hyphen", () => {
    expect(slugifyTitle("Baldur's Great")).to.equal("baldurs-great");
    expect(slugifyTitle("Baldur’s Great")).to.equal("baldurs-great");
  });

  it("A6 with a curly apostrophe yields the same URL", () => {
    const title = "SBFVGS - Ep.192: Baldur’s Great 3 - Delving Deep into Larian’s Latest";
    expect(buildSiteUrl(title, new Date(dates.A6))).to.equal(cases[4][2]);
  });

  it("uses the UTC date of the pubDate", () => {
    const pubDate = new Date("Mon, 20 Jul 2026 23:30:00 -0700");
    expect(buildSiteUrl("SBFVGS - Ep.205: The Gaming Apocalypse", pubDate))
      .to.equal("https://sbfvgs.com/2026/07/21/sbfvgs-ep-205-the-gaming-apocalypse/");
  });

  it("A12: returns null for missing/invalid date or unusable title", () => {
    expect(buildSiteUrl("SBFVGS - Ep.1: X", null)).to.equal(null);
    expect(buildSiteUrl("SBFVGS - Ep.1: X", new Date("garbage"))).to.equal(null);
    expect(buildSiteUrl("", new Date(dates.A1))).to.equal(null);
    expect(buildSiteUrl("!!!", new Date(dates.A1))).to.equal(null);
  });
});

describe("#parseFeed siteUrl", () => {
  const item = (title: string, pubDate: string | null, adl = "ADL1111111111", episode: number | null = null): string => `
    <item>
      <title>${title}</title>
      <description>d</description>
      ${pubDate ? `<pubDate>${pubDate}</pubDate>` : ""}
      ${episode === null ? "" : `<itunes:episode>${episode}</itunes:episode>`}
      <enclosure url="https://pdcn.co/e/traffic.megaphone.fm/${adl}.mp3" length="0" type="audio/mpeg"/>
    </item>`;
  const feed = (...items: string[]): string => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel><title>T</title>${items.join("")}</channel>
</rss>`;
  const one = (xmlItem: string) => parseFeed(feed(xmlItem, item("Filler", null)))[0];

  it("A2: standard title and date", () => {
    expect(one(item("SBFVGS - Ep.204: The Game Awards!", "Mon, 15 Dec 2025 12:00:00 GMT", "ADL1", 204)).siteUrl)
      .to.equal("https://sbfvgs.com/2025/12/15/sbfvgs-ep-204-the-game-awards/");
  });

  it("A6: entity-encoded apostrophe is decoded then slugged", () => {
    // &apos; is decoded by fast-xml-parser (numeric entities are covered in the next test).
    const xml = item("SBFVGS - Ep.192: Baldur&apos;s Great 3 - Delving Deep into Larian&apos;s Latest", "Mon, 21 Aug 2023 12:00:00 GMT");
    expect(one(xml).siteUrl)
      .to.equal("https://sbfvgs.com/2023/08/21/sbfvgs-ep-192-baldurs-great-3-delving-deep-into-larians-latest/");
  });

  it("A6b: numeric entities in a title are NOT decoded (pinned current behavior)", () => {
    // None occur in the real feed. If parseFeed ever starts decoding them, this test
    // should be replaced with one expecting the A6 URL.
    const ep = one(item("SBFVGS - Ep.192: Baldur&#8217;s Great", "Mon, 21 Aug 2023 12:00:00 GMT"));
    expect(ep.title).to.equal("SBFVGS - Ep.192: Baldur&#8217;s Great");
    expect(ep.siteUrl).to.equal("https://sbfvgs.com/2023/08/21/sbfvgs-ep-192-baldur-8217-s-great/");
    const hex = one(item("SBFVGS - Ep.192: Baldur&#x2019;s Great", "Mon, 21 Aug 2023 12:00:00 GMT"));
    expect(hex.title).to.equal("SBFVGS - Ep.192: Baldur&#x2019;s Great");
    expect(hex.siteUrl).to.equal("https://sbfvgs.com/2023/08/21/sbfvgs-ep-192-baldur-x2019-s-great/");
  });

  it("A4: works without itunes:episode", () => {
    expect(one(item("SBFVGS - Ep.201: The End of the Console Wars", "Mon, 03 Mar 2025 12:00:00 GMT")).siteUrl)
      .to.equal("https://sbfvgs.com/2025/03/03/sbfvgs-ep-201-the-end-of-the-console-wars/");
  });

  it("A11: a new standard-pattern episode gets a computed link", () => {
    const title = "SBFVGS - Ep.250: Some Future Episode";
    expect(_siteUrlOverrides.has(title)).to.equal(false);
    expect(one(item(title, "Mon, 05 Jan 2032 12:00:00 GMT")).siteUrl)
      .to.equal("https://sbfvgs.com/2032/01/05/sbfvgs-ep-250-some-future-episode/");
  });

  it("A8: hand-edited slug uses the override", () => {
    expect(one(item("SBFVGS - Ep.91: Is the PlayStation 5 Right Around the Corner?", "Mon, 19 Mar 2018 08:00:00 GMT")).siteUrl)
      .to.equal("https://sbfvgs.com/2018/03/19/sbfvgs-ep-91-is-the-ps5-right-around-the-corner/");
  });

  it("A9: -is-live suffix uses the override", () => {
    expect(one(item("Super Best Friends Video Game Sleepover - Episode 6", "Mon, 15 Dec 2014 16:21:00 GMT")).siteUrl)
      .to.equal("https://sbfvgs.com/2014/12/15/super-best-friends-video-game-sleepover-episode-6-is-live/");
  });

  it("A10: an episode overridden to null has siteUrl null and keeps the player link", () => {
    const title = "SBFVGS - Ep.999: Made-up Episode With No Page";
    const overrides = new Map<string, string | null>([[title, null]]);
    const ep = parseFeed(feed(item(title, "Sat, 18 Dec 2021 13:00:00 GMT", "ADL9990000000"), item("Filler", null)), overrides)[0];
    expect(ep.siteUrl).to.equal(null);
    expect(ep.playerUrl).to.equal("https://playlist.megaphone.fm/?e=ADL9990000000");
  });

  it("a supplied overrides map replaces the production table for that call", () => {
    const title = "SBFVGS - Ep.91: Is the PlayStation 5 Right Around the Corner?";
    const ep = parseFeed(feed(item(title, "Mon, 19 Mar 2018 08:00:00 GMT"), item("Filler", null)), new Map())[0];
    expect(ep.siteUrl).to.equal(buildSiteUrl(title, new Date("Mon, 19 Mar 2018 08:00:00 GMT")));
  });

  it("the production table has no null values", () => {
    for (const url of _siteUrlOverrides.values()) expect(url).to.be.a("string");
  });

  it("Ep.182 and Sleepover Ep.1 use their approved override URLs", () => {
    expect(one(item("SBFVGS - Ep.182: A Very Super Best Friends Video Game Christmas VIII!", "Sun, 19 Dec 2021 03:00:00 GMT")).siteUrl)
      .to.equal("https://sbfvgs.com/2021/12/19/sbfvgs-ep-182-a-very-super-best-friends-video-game-christmas-viii/");
    expect(one(item("Super Best Friends Video Game Sleepover - Episode 1", "Tue, 07 Oct 2014 16:00:00 GMT")).siteUrl)
      .to.equal("https://sbfvgs.com/2014/10/14/sbfvgs-podcast-episode-1-is-live/");
  });

  it("A12: item without pubDate has siteUrl null", () => {
    expect(one(item("SBFVGS - Ep.204: The Game Awards!", null)).siteUrl).to.equal(null);
  });

  it("A13: every override value is null or a well-formed sbfvgs.com post URL", () => {
    expect(_siteUrlOverrides.size).to.be.greaterThan(0);
    for (const [, url] of _siteUrlOverrides) {
      if (url !== null) expect(url).to.match(/^https:\/\/sbfvgs\.com\/\d{4}\/\d{2}\/\d{2}\/[a-z0-9-]+\/$/);
    }
  });
});

describe("#fuzzyFilter", () => {
  let episodes: Episode[];

  before(() => {
    clearCache();
    episodes = parseFeed(FIXTURE_XML);
  });

  it("returns empty array when no terms match", () => {
    expect(fuzzyFilter(episodes, "xyznotarealword")).to.deep.equal([]);
  });

  it("is case-insensitive", () => {
    const results = fuzzyFilter(episodes, "HADES");
    expect(results).to.have.length(1);
    expect(results[0].number).to.equal(10);
  });

  it("ranks episodes with more term matches higher", () => {
    const results = fuzzyFilter(episodes, "hades supergiant greg");
    expect(results[0].number).to.equal(10);
  });

  it("matches multi-word queries across title and description", () => {
    const results = fuzzyFilter(episodes, "sbfvgsgoty game year");
    expect(results[0].number).to.equal(9);
  });

  it("ignores single-character terms", () => {
    const results = fuzzyFilter(episodes, "a b c hades");
    expect(results).to.have.length(1);
    expect(results[0].number).to.equal(10);
  });

  it("filters stop words so common query words do not dilute scoring", () => {
    const results = fuzzyFilter(episodes, "find the episode where hades");
    expect(results).to.have.length(1);
    expect(results[0].number).to.equal(10);
  });

  it("respects the N limit", () => {
    const results = fuzzyFilter(episodes, "sbfvgs", 2);
    expect(results).to.have.length.at.most(2);
  });
});
