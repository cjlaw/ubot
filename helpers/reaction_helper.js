export function handleUpvoteReaction(reaction, user) {
  const content = formatContent(reaction.message.content);
  return `<@${reaction.message.author.id}>++ received an upvote from <@${user.id}> for ${content}`;
}

export function handleTwssReaction(reaction, user) {
  const content = formatContent(reaction.message.content);
  return `<@${user.id}> said ${reaction.emoji} to ${content}`;
}

const formatContent = (content) => {
  return content.indexOf("http") > -1 ? content : `"_${content}_"`;
};
