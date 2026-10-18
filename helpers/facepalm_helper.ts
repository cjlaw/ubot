import type { Message } from "discord.js";
import { formatError } from "./error_helper.js";

export function handleFacepalmMention(message: Message): string | undefined {
  if (
    message.content.match(/Trump/i) &&
    !message.content.includes(":man_facepalming:")
  ) {
    message.react("🤦‍♂️").catch((err: unknown) => console.error("Failed to add facepalm reaction:", formatError(err)));
    return `**burywite** said :man_facepalming: to something about Trump`;
  }
}
