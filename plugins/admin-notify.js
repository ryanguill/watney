const _ = require('lodash');

module.exports = (function(){

	let bot,
		redis,
		config,
		adminChannel;

	function notify (message, channel, user) {
		let [command, ...rest] = message.parts;

		let msg = `*admin-notify* ${bot.makeMention(user)} sent: \n> ${rest.join(' ')}`;


		const targetChannel = bot.getChannelGroupOrDMByName(adminChannel);

		if (!_.isUndefined(targetChannel)) {
			return targetChannel.send(msg);
		} else {
			console.log('Invalid admin channel!', adminChannel);
			return channel.send('sorry, I haven`t been configured properly to do that! Notify the owner of the group that ' +
				'I need to be configured to know what the admin channel is.');
		}
	}


	return function init (_bot, _config) {
		bot = _bot;
		config = _config;
		redis = bot.redis;

		adminChannel = config.adminChannel;

		if (_.isUndefined(adminChannel)) {
			console.log('adminChannel not defined!');
		} else if (!_.contains(bot.channelList, adminChannel) && !_.contains(bot.groupList, adminChannel)) {
			console.log('Invalid adminChannel:', adminChannel, 'I am not part of that channel.  ' +
				'I must be invited to that channel.');
		}

		bot.register({
			pattern: {startsWith: '!admin'},
			f: notify,
			type: 'OUT',
			eventType: 'message',
			priority: 1000,
			flags: {}
		});

	};


})();