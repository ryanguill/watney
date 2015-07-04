const _ = require('lodash');
const moment = require('moment');

module.exports = (function(){

	let bot;

	function random8ball (from) {
		let responses = [
			'As I see it, yes.'
			, 'It is certain.'
			, 'It is decidedly so.'
			, 'Most likely.'
			, 'Outlook good.'
			, 'Signs point to yes.'
			, 'Without a doubt.'
			, 'Yes.'
			, 'Yes - definitely.'
			, 'You may rely on it.'
			, 'Reply hazy, try again.'
			, 'Ask again later.'
			, 'Better not tell you now.'
			, 'Cannot predict now.'
			, 'Concentrate and ask again.'
			, 'Don`t count on it.'
			, 'My reply is no.'
			, 'My sources say no.'
			, 'Outlook not so good.'
			, 'Very doubtful.'];

		return responses[_.random(0, responses.length)].split('{from}').join(from);
	}

	function give8BallResponse (message, channel, user) {
		channel.send(random8ball(bot.makeMention(user)));
	}

	function give8BallResponseUserCheck (message, channel, user) {
		let [mentionedUser] = message.parts;

		mentionedUser = _.first(mentionedUser.split('>')).trim();

		mentionedUser = bot.getUserForMention(mentionedUser);

		if (!_.isUndefined(mentionedUser) && bot.id === mentionedUser.id) {
			give8BallResponse(message, channel, user);
		}
	}

	function giveTime (message, channel, user) {
		channel.send('It is currently ' + moment().utc().format('YYYY-MM-DD HH:mm [UTC]'));
	}

	return function init (_bot) {
		bot = _bot;

		bot.register({
			pattern: {command: '!time'},
			f: giveTime,
			type: 'OUT'});

		bot.register({
			pattern: {command: '!8ball'},
			f: give8BallResponse,
			type: 'OUT'});

		bot.register({
			pattern: {regex: new RegExp('^' + bot.botName + '[\s]*.*\?')},
			f: give8BallResponse,
			type: 'OUT'
		});

		bot.register({
			pattern: {regex: /^<@U.{8}>[\s]*.*\?/},
			f: give8BallResponseUserCheck,
			type: 'OUT'
		});

	};


})();