require('dotenv').config();

const commandRouter = require('./app/command_router');
const ReactionHelper = require('./app/helpers/reaction_helper');
const Discord = require('discord.js');
const bot = new Discord.Client();
const TOKEN = process.env.bot_token;
const SBFVGS_ID = '216034888372060162';

bot.on('message', message => {

	if (process.env.botenv === "production") {
		if (message.content.startsWith("!")) {
			this.commandRouter.route(message);
		}
	} else {
		if (message.content.startsWith("?")) {
			this.commandRouter.route(message);
		}
	}

	if (message.content.match(/Arnie/i) || message.content.match(/Arnold/i)) {
		message.content += " arnie"; // Make sure "arnie" is present to match the command name
		this.commandRouter.route(message);
	}
});

bot.on('ready', () => {
	bot.user.setGame('Latest SBFVGS Podcast');
	this.commandRouter = new commandRouter(bot, SBFVGS_ID);
	console.log('this bot is now ready.');
});

bot.on('guildMemberAdd', member => {
	member.guild.defaultChannel.send(`Welcome to the server, ${member}!`);
});

bot.on('messageReactionAdd', (reaction, user) => {
	if (reaction.emoji.name === 'upvote') {
		reaction.message.channel.send(ReactionHelper.handleUpvoteReaction(reaction, user));
	}
	if (reaction.emoji.name === 'twss') {
		reaction.message.channel.send(ReactionHelper.handleTwssReaction(reaction, user));
	}
});

bot.login(TOKEN);