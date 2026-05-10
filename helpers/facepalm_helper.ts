import type { Message } from "discord.js";

export function handleFacepalmMention(message: Message): string | undefined {
  if (
    message.content.match(/Trump/i) &&
    !message.content.includes(":man_facepalming:")
  ) {
    message.react("🤦‍♂️");
    return `**burywite** said :man_facepalming: to something about Trump`;
  }
}
