require('dotenv').config();
const commandRouter = require('./command_router');

const botenv = process.env.ENV || "debug" // the bot's current running environment.
const http = require('http');
const port = process.env.PORT || 8888; // used for a very simple webserver (keeps heroku from shutting down the bot)
http.createServer(function (request, response) { response.statusCode = 200; response.end(); }).listen(port);

//const request = require('request');

// import the discord.js module
const Discord = require('discord.js');
// create an instance of a Discord Client, and call it bot
const bot = new Discord.Client();
// the token of your bot - https://discordapp.com/developers/applications/me
const TOKEN = process.env.bot_token;
const SBFVGS_ID = '216034888372060162';

// create an event listener for messages
bot.on('message', message => {
  if (message.isMentioned(bot.user)) {
    this.commandRouter.route(message);
  }
});

// the ready event is vital, it means that your bot will only start reacting to information
// from Discord _after_ ready is emitted.
bot.on('ready', () => {
  bot.user.setGame('Latest SBFVGS Podcast');
  this.commandRouter = new commandRouter(bot, SBFVGS_ID);
});

// log our bot in
bot.login(TOKEN);
