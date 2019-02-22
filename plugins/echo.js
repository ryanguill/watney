'use strict';

var _ = require('lodash');

module.exports = (function () {

	var bot;
	var redis;

	var lastMessage = '';

	var echo = function echo(message, channel, user) {

		return channel.send(bot.makeMention(user) + ' ' + _.tail(message.parts).join(' '));
	};

	var storeLast = function storeLast(message, channel, user) {
		lastMessage = bot.makeMention(user) + ' said  `' + message.text + '`';
		//console.log('storeLast', lastMessage);
	};

	var getLastMessage = function getLastMessage(message, channel) {
		if (lastMessage.length) {
			return channel.send(lastMessage);
		} else {
			return channel.send('I can`t remember...');
		}
	};

	return function init(_bot) {
		bot = _bot;
		redis = bot.redis;

		//empty pattern matches everything
		bot.register({ pattern: {},
			f: storeLast,
			type: 'IN' });

		bot.register({ pattern: { startsWith: '!lastMessage' },
			f: getLastMessage,
			type: 'OUT',
			priority: 1000 });

		bot.register({ pattern: { startsWith: '!echo' },
			f: echo,
			type: 'OUT',
			priority: 1000 });
	};
})();