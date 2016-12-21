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

		return responses[_.random(0, responses.length - 1)].split('{from}').join(from);
	}

	function randomMingo (from) {
		let responses = [
			'_unstable_ - pcmag'
			, 'There is _No timeline for Mingo`s full release_'
			, '_small & fast_'
			, ' wants you to _stahp, pls_'
			, 'm.i.n.g.o. and mingo was his name-o'
			, '2min have passed.  it is 12:28.  His name-o was still mingo'
		];

		return responses[_.random(0, responses.length - 1)].split('{from}').join(from);
	}

	function give8BallResponse (message, channel, user) {
		channel.send(random8ball(bot.makeMention(user)));
	}

	function giveMingoResponse (message, channel, user) {
		channel.send(randomMingo(bot.makeMention(user)));
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

	function sendHelp (message, channel, user) {
		let [command, helpUser] = message.parts;

		if (!_.isUndefined(helpUser)) {
			helpUser = _.first(helpUser.split('>')).trim() + '>';
			helpUser = bot.getUserForMention(helpUser);
		} else {
			helpUser = user;
		}

		function doSend (helpUser) {
			let dm = bot.getDMByName(helpUser.name);
			bot.setCooldown(['help-from.' + user.name, 'help-to.' + helpUser.name], 5 * 60);
			dm.send('Hi! My name is ' + bot.makeMention(bot.self) + ', an open source slack bot.\n' +
				'Here is some documentation of what I can do for you: https://github.com/ryanguill/watney/blob/master/help.md' +
				'\n You can chat to me in any channel that I am a part of, including this DM.\nYou can also use /invite ' +
				bot.makeMention(bot.self) + ' to add me to any room I am not currently participating in.\n\n' +
				'I am an open source project and pull requests, bug reports and feature ideas are welcome! Or you can fork ' +
				'and use me in your own slack rooms.  https://github.com/ryanguill/watney'
			);

			bot.ops.isOp(helpUser.name, (err, data) => {
				if (err) return channel.send('error! ' + err);
				if (data === 1) dm.send('OP help commands: https://github.com/ryanguill/watney/blob/master/ops-help.md');
			});
		}

		bot.isOnCooldown(['help-from.' + user.name, 'help-to.' + helpUser.name], (err, data) => {
			if (err) return channel.send('error! ', err);
			if (!data) {
				let dm = bot.getDMByName(helpUser.name);
				if (_.isUndefined(dm)) {
					dm = bot.openDM(helpUser.id, (args) => {
						_.delay(() => doSend(helpUser), 1000);
					});
				} else {
					return doSend(helpUser);
				}
			} else {
				channel.send('Maybe I can`t give you the help you need... (you can only use !help once every 5 minutes');
			}
		});
	}

	return function init (_bot) {
		bot = _bot;

		bot.register({
			pattern: {command: '!help'},
			f: sendHelp,
			type: 'OUT'});

		bot.register({
			pattern: {command: '!time'},
			f: giveTime,
			type: 'OUT'});

		bot.register({
			pattern: {command: '!8ball'},
			f: give8BallResponse,
			type: 'OUT'});
/*
		bot.register({
			pattern: {command: '!mingo'},
			f: giveMingoResponse,
			type: 'OUT'});
*/
		bot.register({
			pattern: {regex: new RegExp('^' + bot.botName + '[\s]*.*\?', 'i')},
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