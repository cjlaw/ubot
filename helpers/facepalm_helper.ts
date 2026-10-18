import type { Message } from "discord.js";

export function handleFacepalmMention(message: Message): string | undefined {
  if (
    message.content.match(/Trump/i) &&
    !message.content.includes(":man_facepalming:")
  ) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises -- #164
    message.react("🤦‍♂️");
    return `**burywite** said :man_facepalming: to something about Trump`;
  }
}
