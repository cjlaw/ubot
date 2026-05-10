import { SlashCommandBuilder, MessageFlags } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import * as chrono from "chrono-node";
import { formats, getOffsetMinutes } from "../helpers/timestamp_helper.js";

export const data = new SlashCommandBuilder()
  .setName("timestamp")
  .setDescription("Generates Discord timestamp tags for a given date and time")
  .addStringOption((option) =>
    option
      .setName("input")
      .setDescription("When? (e.g. \"tomorrow at 5pm\", \"in 5 hours\", \"4/24 5pm\", \"9:30am\")")
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName("timezone")
      .setDescription("Your timezone")
      .setRequired(true)
      .addChoices(
        { name: "Eastern (USA)", value: "America/New_York" },
        { name: "Central (USA)", value: "America/Chicago" },
        { name: "Mountain (USA)", value: "America/Denver" },
        { name: "Pacific (USA)", value: "America/Los_Angeles" },
        { name: "GMT (EU)", value: "Europe/London" },
        { name: "CET (EU)", value: "Europe/Paris" },
        { name: "EET (EU)", value: "Europe/Athens" },
        { name: "AEST (AU)", value: "Australia/Sydney" },
        { name: "ACST (AU)", value: "Australia/Adelaide" },
        { name: "AWST (AU)", value: "Australia/Perth" }
      )
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const input = interaction.options.getString("input", true);
  const timezone = interaction.options.getString("timezone", true);

  const now = new Date();
  const roughParsed = chrono.parseDate(input, now);

  if (!roughParsed) {
    await interaction.editReply("Couldn't understand that date. Try something like \"tomorrow at 5pm\", \"in 5 hours\", or \"4/24 5pm\".");
    return;
  }

  const offsetMinutes = getOffsetMinutes(timezone, roughParsed);
  const parsed = chrono.parseDate(input, { instant: now, timezone: offsetMinutes }) ?? roughParsed;

  const unix = Math.floor(parsed.getTime() / 1000);

  const humanReadable = parsed.toLocaleString("en-US", {
    timeZone: timezone,
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });

  const pastWarning = parsed < now ? "\n⚠️ That date is in the past." : "";

  const lines = formats.map((style) => {
    const note = style === "R" ? " *(everyone sees this in their own local time)*" : "";
    return `\`<t:${unix}:${style}>\` → <t:${unix}:${style}>${note}`;
  });

  await interaction.editReply(`Timestamp for **${humanReadable}**:\n${lines.join("\n")}${pastWarning}`);
}
