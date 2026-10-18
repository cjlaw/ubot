import type { PollData } from "discord.js";

export const REGIONAL_INDICATORS: readonly string[] = ["🇦", "🇧", "🇨", "🇩", "🇪"];

export const DEFAULT_DURATION_HOURS = 24;
export const MIN_DURATION_HOURS = 1;
export const MAX_DURATION_HOURS = 768;
export const MIN_ANSWERS = 2;
export const MAX_ANSWERS = 5;
export const MAX_QUESTION_LENGTH = 300;
export const MAX_ANSWER_LENGTH = 55;

export function normalizeDuration(raw: number | null | undefined): number {
  if (
    typeof raw === "number" &&
    Number.isInteger(raw) &&
    raw >= MIN_DURATION_HOURS &&
    raw <= MAX_DURATION_HOURS
  ) {
    return raw;
  }
  return DEFAULT_DURATION_HOURS;
}

export function buildPollPayload(
  question: string,
  answers: string[],
  durationHours: number,
  allowMultiselect: boolean,
): { poll: PollData } {
  if (answers.length < MIN_ANSWERS) {
    throw new Error(`A poll needs at least ${MIN_ANSWERS} answers.`);
  }
  if (answers.length > MAX_ANSWERS) {
    throw new Error(`A poll can have at most ${MAX_ANSWERS} answers.`);
  }
  return {
    poll: {
      question: { text: question },
      answers: answers.map((text, i) => ({ text, emoji: REGIONAL_INDICATORS[i] })),
      duration: durationHours,
      allowMultiselect,
    },
  };
}
