import {
  EmbedBuilder,
  InteractionContextType,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { ChatInputCommandInteraction, ModalSubmitInteraction } from "discord.js";
import { formatError } from "../helpers/error_helper.js";

export const TITLE_MAX = 100;
export const DESCRIPTION_MAX = 1000;
export const COOLDOWN_MS = 60 * 60 * 1000;
export const MODAL_ID = "featurerequest";

const lastSubmitMs = new Map<string, number>();

// Test seams — not for production use.
export function _resetCooldowns(): void {
  lastSubmitMs.clear();
}
export function _setCooldown(userId: string, ms: number): void {
  lastSubmitMs.set(userId, ms);
}
export function _getCooldownSize(): number {
  return lastSubmitMs.size;
}

function cooldownExpiry(userId: string): number | null {
  const last = lastSubmitMs.get(userId);
  if (last === undefined) return null;
  const expiry = last + COOLDOWN_MS;
  return expiry > Date.now() ? expiry : null;
}

function startCooldown(userId: string): void {
  const now = Date.now();
  for (const [uid, last] of lastSubmitMs) {
    if (last + COOLDOWN_MS <= now) lastSubmitMs.delete(uid);
  }
  lastSubmitMs.set(userId, now);
}

const cooldownMessage = (expiry: number): string =>
  `You're on cooldown. You can submit another feature request <t:${Math.floor(expiry / 1000)}:R>.`;

const FAILURE_MESSAGE = "Sorry, your request couldn't be filed.";

export const data = new SlashCommandBuilder()
  .setName("featurerequest")
  .setDescription("Submit a feature request for ubot")
  .setContexts(InteractionContextType.Guild);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild()) {
    await interaction.reply({
      content: "This command only works in the server.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const expiry = cooldownExpiry(interaction.user.id);
  if (expiry !== null) {
    await interaction.reply({ content: cooldownMessage(expiry), flags: MessageFlags.Ephemeral });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(MODAL_ID)
    .setTitle("Feature request")
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Title")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("title")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(TITLE_MAX),
        ),
      new LabelBuilder()
        .setLabel("Description")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("description")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(DESCRIPTION_MAX),
        ),
    );
  await interaction.showModal(modal);
}

export async function handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  const userId = interaction.user.id;
  const expiry = cooldownExpiry(userId);
  if (expiry !== null) {
    await interaction.reply({ content: cooldownMessage(expiry), flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const title = interaction.fields.getTextInputValue("title");
  const description = interaction.fields.getTextInputValue("description");
  const channelId = process.env.FEATURE_REQUEST_CHANNEL_ID;
  const maintainerId = process.env.FEATURE_REQUEST_MAINTAINER_ID;

  try {
    if (!channelId) throw new Error("FEATURE_REQUEST_CHANNEL_ID is not set");
    const channel = await interaction.client.channels.fetch(channelId);
    if (!channel || !channel.isSendable()) throw new Error("Feature request channel is missing or not sendable");

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .addFields({ name: "Submitted by", value: `<@${userId}>` });

    await channel.send({
      content: maintainerId ? `<@${maintainerId}>` : undefined,
      embeds: [embed],
      allowedMentions: { parse: [], users: maintainerId ? [maintainerId] : [] },
    });
  } catch (error) {
    console.error("Feature request failed:", formatError(error));
    await interaction.editReply({ content: FAILURE_MESSAGE });
    return;
  }

  startCooldown(userId);
  await interaction.editReply({ content: "Your feature request was submitted — thanks!" });
}
