const _ = require('lodash');
const moment = require('moment');

module.exports = (function(){

	let bot,
		redis,
		config,
		adminChannel,
		redisNotesKey;

	function persistNote (targetUser, authorUser, note) {
		getNotesByUser(targetUser, function(err, data) {
			if (err) {
				return console.error(err);
			}
			data = JSON.parse(data || '[]');
			data.unshift({authorUser: authorUser, targetUser: targetUser, dte: Date.now(), note: note});
			redis.hset(redisNotesKey, targetUser, JSON.stringify(data));
		});

	}

	function getNotesByUser (targetUser, callback) {
		redis.hget(redisNotesKey, targetUser, callback);
	}

	function getUsersWithNotes (callback) {
		redis.hkeys(redisNotesKey, callback);
	}

	function takeNote (message, channel, user) {
		//only consider this in the admin channel.  Do not even respond if not in that channel.
		if (channel.name !== adminChannel) {
			console.log(`cant take a !note from ${channel.name}`);
			return;
		}

		let [command, flag, receiverUsername, ...rest] = message.parts;

		if (_.isUndefined(receiverUsername)) {
			return channel.send("who is the note about? use the format: `!note -add @user {note}`");
		}

		let slackUser = bot.getUserForMention(receiverUsername);
		if (_.isUndefined(slackUser)) {
			slackUser = bot.getUserByName(receiverUsername);
		}

		if (_.isUndefined(slackUser)) {
			return channel.send('I`m not sure who ' + receiverUsername + ' is...');
		}

		let note = rest.join(' ').trim();

		if (note.length === 0) {
			return channel.send(`please provide a note for ${receiverUsername}`);
		}

		persistNote(slackUser.name, user.name, rest.join(' '));

		return channel.send(`note added for ${slackUser.name}`);
	}

	function listNotes (message, channel, user) {
		//only consider this in the admin channel.  Do not even respond if not in that channel.
		if (channel.name !== adminChannel) {
			console.log(`cant take a !note from ${channel.name}`);
			return;
		}

		let [command, flag, receiverUsername, ...rest] = message.parts;

		if (_.isUndefined(receiverUsername)) {
			return getUsersWithNotes(function(err, data) {
				if (err) {
					console.error(err);
					return channel.send(`error getting users with notes: ${err}`);
				}
				data = data || [];
				return channel.send(`I have notes about the following users: ${data.join(', ')}`);
			});
		}

		let slackUser = bot.getUserForMention(receiverUsername);
		if (_.isUndefined(slackUser)) {
			slackUser = bot.getUserByName(receiverUsername);
		}

		if (_.isUndefined(slackUser)) {
			return channel.send('I`m not sure who ' + receiverUsername + ' is...');
		}

		return getNotesByUser(slackUser.name, function (err, data) {
			if (err) {
				console.error(err);
				return channel.send(`error getting notes for ${slackuser}: ${err}`);
			}

			data = JSON.parse(data || '[]');

			let response = '';

			if (data.length === 0) {
				response = `there are not yet any notes for ${slackUser.name}`;
			} else {
				response = `${data.length} note${(data.length == 1 ? '' : 's')} for ${slackUser.name}\n\n`;

				response = _.reduce(data, function (response, note) {
					return response + moment(note.dte).format('YYYY-MM-DDTHH:mm:ss[Z]') + ` by ${note.authorUser}\n>${note.note}\n\n`;
				}, response);
			}

			return channel.send(response);
		});
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

		redisNotesKey = bot.botName + '-' + adminChannel + '.notes';

		bot.register({
			pattern: {regex: /^!note -add/g},
			f: takeNote,
			type: 'OUT',
			eventType: 'message',
			priority: 1000,
			flags: {}
		});

		bot.register({
			pattern: {regex: /^!note[s]? -list/g},
			f: listNotes,
			type: 'OUT',
			eventType: 'message',
			priority: 1000,
			flags: {}
		});

	};


})();