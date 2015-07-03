const _ = require('lodash');
const moment = require('moment');

module.exports = (function(){

	let bot;
	let redis;
	let maxUsers;

	function displayRunningTime (message, channel) {
		channel.send('I have been running for ' + moment(bot.starttime).fromNow(true));
	}

	function displayStatsForChannel (channel, replyToChannel) {

		getMessageCountLeaderboard(channel, function(err, data){

			let channelTotal = _.sum(_.values(data));

			//todo: refactor and clean this up further
			var leaders = _.map(
				_.sortBy(
					_.filter(
						_.map(data, (item, key) => [key, item]),
							item => item[0] !== channel.name),
					value => _.parseInt(value[1], 10))
					.reverse()
					.slice(0, 10),
				item => item[0] + ': ' + item[1] + ' (' + _.parseInt((item[1] / channelTotal) * 100, 10) + '%)').join(', ');

			replyToChannel.send('Total Messages for #' + channel.name + ': ' + channelTotal +
				'. Most talkative users are: ' + leaders);
		});

	}

	function setLastSeen (message, channel, user) {
		if (!_.isUndefined(user)) {
			redis.hset(bot.botName + '.' + channel.name + '.lastseen', user.name.toLowerCase(), Date.now());
		}
	}

	function getUserMessageCount (channel, user, callback) {
		redis.hget(bot.botName + '.' + channel.name + '.messageCount', user.name.toLowerCase(), callback);
	}

	function getMessageCountLeaderboard (channel, callback) {
		redis.hgetall(bot.botName + '.' + channel.name + '.messageCount', callback);
	}

	function resetStats (channel) {
		redis.del(bot.botName + '.' + channel.name + '.messageCount');
	}

	function countMessage (message, channel, user) {
		if (!_.isUndefined(user)) {
			redis.sadd(bot.botName + '.channels', channel.name);
			//redis.hincrby(bot.botName + '.' + channel.name + '.messageCount', '#' + channel.name, 1);
			redis.hincrby(bot.botName + '.' + channel.name + '.messageCount', user.name.toLowerCase(), 1);

			getUserMessageCount(channel, user, function (err, data) {
				if (data !== null && _.isNumber(_.parseInt(data)) && data % 1000 === 0) {
					var time = '';
					if (user.name === bot.botName) {
						time = moment().millisecond(5 * data).fromNow(true);
						channel.send('Congrats ' + user.name + '! Your ' + data + 'th message was: `' + message.text +
							'` ~ guessing an average of 5 milliseconds per message, that`s about ' + time + ' spent in IRC!');
					} else {
						time = moment().seconds(5 * data).fromNow(true);
						channel.send('Congrats ' + user.name + '! Your ' + data + 'th message was: `' + message.text +
							'` ~ guessing an average of 5 seconds per message, that`s about ' + time + ' spent in IRC!');
					}
				}
			});
		}
	}

	function showStats (message, channel, user) {
		displayStatsForChannel(channel, channel);
		displayRunningTime(message, channel);
	}

	function showAllStats (message, replyToChannel, user) {
		_.each(bot.channelList, (channelName) => {
			let channel = bot.getChannelByName(channelName);
			displayStatsForChannel(channel, replyToChannel);
		});
		displayRunningTime(message, replyToChannel);
	}

	function showUserStats (message, channel, user) {
		let [command, statsUser] = message.parts;

		let slackUser = bot.getUserForMention(statsUser);
		if (_.isUndefined(slackUser)) {
			slackUser = bot.getUserByName(statsUser);
		}

		if (_.isUndefined(slackUser)) {
			return channel.send('I`m not sure who you are asking about.  Use !stats @username');
		}

		getUserMessageCount(channel, slackUser, (err, data) => {
			return channel.send(slackUser.name + ' has sent ' + data + ' message' + (data !== 1 ? 's' : '') +
				' in ' + channel.name);
		});
	}

	function setMaxUsers (maxUsersCount) {
		redis.set(bot.botName + '.maxUsers', JSON.stringify({maxUserCount: maxUsersCount, dte: new Date().getTime()}));
	}

	function getMaxUsers (callback) {
		redis.get(bot.botName + '.maxUsers', callback);
	}

	function highWaterMarkCheck (user, presence) {

		let activeUsers = _.filter(bot.users, {presence: 'active'}).length;
		//console.log('highWaterMarkCheck', user.name, presence, activeUsers, maxUsers);
		if (_.isUndefined(maxUsers) || activeUsers > maxUsers) {
			maxUsers = activeUsers;
			setMaxUsers(activeUsers);
		}
	}

	function displayMaxUsers (message, channel, user) {
		getMaxUsers(function (err, data) {
			if (err) return channel.send('error! ' + err);
			if (!_.isNull(data)) {
				data = JSON.parse(data);
				return channel.send('The most members I have seen online was ' + data.maxUserCount + ' on ' +
					moment(data.dte).format('MMMM Do YYYY, HH:mm:ss Z'));
			} else {
				return channel.send('I`m not sure yet, give me a few minutes and ask again.');
			}
		});
	}

	return function init( _bot) {
		bot = _bot;
		redis = bot.redis;

		bot.countMessage = countMessage;

		_.delay(function() {
			_.each(bot.channelList, (channelName) => {
				getMaxUsers((err, data) => {
					if (err) return console.error(err);
					//console.log('maxusers', data);
					maxUsers = data;
				});
			});
		}, 2000);

		bot.register({
			pattern: {},
			f: setLastSeen,
			type: 'IN'});

		bot.register({
			pattern: {},
			f: countMessage,
			type: 'IN'});

		bot.register({
			pattern: {regex: /!stats$/g},
			f: showStats,
			type: 'OUT'});

		bot.register({
			pattern: {regex: /!stats -all$/g},
			f: showAllStats,
			type: 'OUT'});

		bot.register({
			pattern: {regex: /!stats [^-]+$/g},
			f: showUserStats,
			type: 'OUT'});

		bot.register({
			pattern: {command: '!uptime'},
			f: displayRunningTime,
			type: 'OUT'});

		bot.register({
			pattern: {command: '!maxusers'},
			f: displayMaxUsers,
			type: 'OUT'});

		bot.register({
			eventType: 'presenceChange',
			pattern: {},
			f: highWaterMarkCheck,
			type: 'IN'});

	};
})();
