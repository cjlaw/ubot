import type { MessageReaction, User } from "discord.js";

export function handleUpvoteReaction(reaction: MessageReaction, user: User): string {
  const content = formatContent(reaction.message.content);
  return `<@${reaction.message.author!.id}>++ received an upvote from <@${user.id}> for ${content}`;
}

export function handleTwssReaction(reaction: MessageReaction, user: User): string {
  const content = formatContent(reaction.message.content);
  return `<@${user.id}> said ${reaction.emoji} to ${content}`;
}

const formatContent = (content: string | null): string => {
  if (!content) return '""';
  return content.indexOf("http") > -1 ? content : `"_${content}_"`;
};
