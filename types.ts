import type { SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction } from "discord.js";

export interface Episode {
  number: string | number | null;
  title: string;
  description: string;
  pubDate: Date | null;
  playerUrl: string;
  audioUrl: string;
}

export interface EpisodeResult {
  episode: Episode;
}

export interface SearchResult {
  results: EpisodeResult[];
  fallback: boolean;
}

export interface Command {
  data: SlashCommandBuilder | Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}
