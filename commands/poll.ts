import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import {
  MAX_ANSWER_LENGTH,
  MAX_DURATION_HOURS,
  MAX_QUESTION_LENGTH,
  MIN_DURATION_HOURS,
  buildPollPayload,
  normalizeDuration,
} from "../helpers/poll_helper.js";

export const data = new SlashCommandBuilder()
  .setName("poll")
  .setDescription("Create a poll with 2-5 answers")
  .addStringOption((o) =>
    o.setName("question").setDescription("The poll question").setRequired(true).setMaxLength(MAX_QUESTION_LENGTH))
  .addStringOption((o) =>
    o.setName("answer1").setDescription("Answer 🇦").setRequired(true).setMaxLength(MAX_ANSWER_LENGTH))
  .addStringOption((o) =>
    o.setName("answer2").setDescription("Answer 🇧").setRequired(true).setMaxLength(MAX_ANSWER_LENGTH))
  .addStringOption((o) =>
    o.setName("answer3").setDescription("Answer 🇨").setMaxLength(MAX_ANSWER_LENGTH))
  .addStringOption((o) =>
    o.setName("answer4").setDescription("Answer 🇩").setMaxLength(MAX_ANSWER_LENGTH))
  .addStringOption((o) =>
    o.setName("answer5").setDescription("Answer 🇪").setMaxLength(MAX_ANSWER_LENGTH))
  .addIntegerOption((o) =>
    o.setName("duration").setDescription("Hours the poll stays open (default 24)")
      .setMinValue(MIN_DURATION_HOURS).setMaxValue(MAX_DURATION_HOURS))
  .addBooleanOption((o) =>
    o.setName("multiselect").setDescription("Allow multiple choices (default off)"));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const answers = ["answer1", "answer2", "answer3", "answer4", "answer5"]
    .map((key) => interaction.options.getString(key))
    .filter((a): a is string => !!a);
  const question = interaction.options.getString("question", true);
  const durationHours = normalizeDuration(interaction.options.getInteger("duration"));
  const multi = interaction.options.getBoolean("multiselect") ?? false;

  let payload;
  try {
    payload = buildPollPayload(question, answers, durationHours, multi);
  } catch (err) {
    await interaction.reply({ content: (err as Error).message, flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.reply(payload);
}
