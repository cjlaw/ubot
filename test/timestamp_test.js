import { expect } from "chai";
import { execute } from "../commands/timestamp.js";
import { formats } from "../helpers/timestamp_helper.js";

const mockInteraction = (input, timezone) => {
  let reply = "";
  const options = { input, timezone };
  return {
    deferReply: async () => {},
    editReply: (content) => { reply = content; },
    getReply: () => reply,
    options: { getString: (key) => options[key] },
  };
};

describe("#command: timestamp", () => {
  describe("-with valid input", () => {
    it("should include both the raw tag and rendered tag for each format", async () => {
      const interaction = mockInteraction("in 2 hours", "America/Chicago");
      await execute(interaction);
      const reply = interaction.getReply();
      for (const style of formats) {
        expect(reply).to.match(new RegExp(`\`<t:\\d+:${style}>\` → <t:\\d+:${style}>`));
      }
    });

    it("should produce a unix timestamp in the future for \"tomorrow at 5pm\"", async () => {
      const before = Math.floor(Date.now() / 1000);
      const interaction = mockInteraction("tomorrow at 5pm", "America/New_York");
      await execute(interaction);
      const match = interaction.getReply().match(/<t:(\d+):/);
      const unix = parseInt(match[1], 10);
      expect(unix).to.be.greaterThan(before);
    });

    it("should produce a unix timestamp approximately 5 hours from now for \"in 5 hours\"", async () => {
      const interaction = mockInteraction("in 5 hours", "America/New_York");
      await execute(interaction);
      const match = interaction.getReply().match(/<t:(\d+):/);
      const unix = parseInt(match[1], 10);
      const expectedApprox = Math.floor(Date.now() / 1000) + 5 * 3600;
      expect(unix).to.be.within(expectedApprox - 60, expectedApprox + 60);
    });

    it("should respect the selected timezone", async () => {
      // Same time expression, different timezones — Eastern is 3 hours ahead of Pacific
      const eastern = mockInteraction("12/25/2099 12:00 pm", "America/New_York");
      const pacific = mockInteraction("12/25/2099 12:00 pm", "America/Los_Angeles");
      await execute(eastern);
      await execute(pacific);
      const easternUnix = parseInt(eastern.getReply().match(/<t:(\d+):/)[1], 10);
      const pacificUnix = parseInt(pacific.getReply().match(/<t:(\d+):/)[1], 10);
      expect(easternUnix).to.be.lessThan(pacificUnix);
    });

    it("should produce the correct offset for a EU timezone", async () => {
      // Same time, CET (UTC+1) is 6 hours ahead of Eastern (UTC-5) in January
      const eastern = mockInteraction("12/25/2099 12:00 pm", "America/New_York");
      const cet = mockInteraction("12/25/2099 12:00 pm", "Europe/Paris");
      await execute(eastern);
      await execute(cet);
      const easternUnix = parseInt(eastern.getReply().match(/<t:(\d+):/)[1], 10);
      const cetUnix = parseInt(cet.getReply().match(/<t:(\d+):/)[1], 10);
      expect(cetUnix).to.be.lessThan(easternUnix);
    });

    it("should add the local time note on the relative format", async () => {
      const interaction = mockInteraction("tomorrow at noon", "America/Denver");
      await execute(interaction);
      expect(interaction.getReply()).to.include("everyone sees this in their own local time");
    });

    it("should include a human-readable confirmation of the parsed date", async () => {
      const interaction = mockInteraction("12/25/2099 12:00 pm", "America/New_York");
      await execute(interaction);
      expect(interaction.getReply()).to.match(/Timestamp for \*\*.+\*\*:/);
    });

    it("should warn when the date is in the past", async () => {
      const interaction = mockInteraction("1/1/2000 12:00 pm", "America/New_York");
      await execute(interaction);
      expect(interaction.getReply()).to.include("⚠️ That date is in the past.");
    });

    it("should not warn when the date is in the future", async () => {
      const interaction = mockInteraction("12/25/2099 12:00 pm", "America/New_York");
      await execute(interaction);
      expect(interaction.getReply()).to.not.include("⚠️");
    });
  });

  describe("-with invalid input", () => {
    it("should reject an unrecognizable input", async () => {
      const interaction = mockInteraction("not a date at all", "America/New_York");
      await execute(interaction);
      expect(interaction.getReply()).to.include("Couldn't understand that date");
    });
  });
});
