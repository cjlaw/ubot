import { expect } from "chai";
import { parseFeed, fuzzyFilter, clearCache } from "../helpers/episode_helper.js";
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
