const _ = require('lodash');

module.exports = (function(){

	let bot,
		redis,
		karma = [],
		karmaBans = [];

	function giveKarma (channel, giver, receiver) {
		karma.push({channel: channel.name, giver: giver.name, receiver: receiver.name, ts: _.now()});
		persistKarma();
	}

	function getUserKarma (username) {
		return karma.filter(k => k.receiver === username);
	}

	function getUserKarmaGiving (username) {
		return karma.filter(k => k.giver === username);
	}

	function persistKarma () {
		redis.set(bot.botName + '.karma', JSON.stringify(karma));
	}

	function loadKarma (callback) {
		redis.get(bot.botName + '.karma', callback);
	}

	function banKarma (channel, giver, receiver) {
		if (!isUserKarmaBanned(receiver)) {
			karmaBans.push({channel: channel.name, giver: giver.name, receiver: receiver.name, ts: _.now()});
			persistKarmaBans();
		}
	}

	function unbanKarma (userName) {
		karmaBans = karmaBans.filter(o => o.receiver !== userName);
		persistKarma();
	}

	function isUserKarmaBanned (userName) {
		return !_.isUndefined(karmaBans.find(o => o.receiver === userName));
	}

	function persistKarmaBans () {
		redis.set(bot.botName + '.karma_bans', JSON.stringify(karmaBans));
	}

	function loadKarmaBans (callback) {
		redis.get(bot.botName + '.karma_bans', callback);
	}

	function getLeaderboard () {
		let receivers = _.uniq(_.pluck(karma, 'receiver'));
		//let sumByReceiver = _.map(_.map(receivers, getUserKarma), karmaList => karmaList.length);
		let sumByReceiver = receivers.map(r => {
			return {receiver: r, value: getUserKarma(r).length};
		});

		sumByReceiver = _.sortBy(sumByReceiver, 'value').reverse();
		let uniqueScores = _.uniq(_.pluck(sumByReceiver, 'value'));

		sumByReceiver = sumByReceiver.map((o, index) => {
			o.place = uniqueScores.findIndex(x => x === o.value) + 1;
			return o;
		});

		return sumByReceiver;
	}

	function getGiverLeaderboard () {
		let givers = _.uniq(_.pluck(karma, 'giver'));

		let sumByGiver = givers.map(r => {
			return {giver: r, value: getUserKarmaGiving(r).length};
		});

		sumByGiver = _.sortBy(sumByGiver, 'value').reverse();
		let uniqueScores = _.uniq(_.pluck(sumByGiver, 'value'));

		sumByGiver = sumByGiver.map((o, index) => {
			o.place = uniqueScores.findIndex(x => x === o.value) + 1;
			return o;
		});

		return sumByGiver;
	}

	function addKarma (message, channel, user, receiverUsername) {

		let slackUser = bot.getUserForMention(receiverUsername);
		if (_.isUndefined(slackUser)) {
			slackUser = bot.getUserByName(receiverUsername);
		}

		if (_.isUndefined(slackUser)) {
			return channel.send('I`m not sure who ' + receiverUsername + ' is...');
		}

		if (slackUser.name === user.name) {
			return channel.send('You can\'t give karma to yourself ಠ_ಠ');
		}

		if (isUserKarmaBanned(slackUser.name)) {
			return channel.send(bot.makeMention(slackUser) + ' is banned from receiving karma.');
		}

		giveKarma(channel, user, slackUser);

		let userKarma = getLeaderboard().find(o => o.receiver === slackUser.name);

		return channel.send(bot.makeMention(user) + ' gives karma to ' + bot.makeMention(slackUser.name) +
			'. They now have ' + userKarma.value + ' karma. #' + userKarma.place + ' overall.');
	}

	function addKarmaSucceeding (message, channel, user) {
		let username = _.first(message.parts).replace(/[:,\s+]/g, '').trim();

		channel.is_im = channel.is_im || false;
		if (channel.is_im) {
			return channel.send("You can not give karma in Direct Messages");
		}

		addKarma(message, channel, user, username);
	}

	function addKarmaPreceding (message, channel, user) {
		let username = _.first(message.text.replace(/\+1[:,]*/g, '').trim().split(' '));

		channel.is_im = channel.is_im || false;
		if (channel.is_im) {
			return channel.send("You can not give karma in Direct Messages");
		}

		addKarma(message, channel, user, username);
	}

	function addKarmaPlusPlus (message, channel, user) {
		let username = _.first(message.text.replace(/[:,]?\s*\+\+/g, '').trim().split(' '));

		channel.is_im = channel.is_im || false;
		if (channel.is_im) {
			return channel.send("You can not give karma in Direct Messages");
		}

		addKarma(message, channel, user, username);
	}

	function displayLeaderboard (message, channel, user) {
		let leaderboard = getLeaderboard();

		channel.send('The top 10 karma holders are ' +
			leaderboard.slice(0,10).map(o => o.receiver + ' (' + o.value + ')').join(', ') +
			'. Total karma holders: ' + leaderboard.length);
	}

	function displayGiverLeaderboard (message, channel, user) {
		let leaderboard = getGiverLeaderboard();

		channel.send('The top 10 karma givers are ' +
			leaderboard.slice(0,10).map(o => o.giver + ' (' + o.value + ')').join(', ') +
			'. Total karma givers: ' + leaderboard.length);
	}

	function displayUserKarma (message, channel, user) {
		let [command, receiverUsername] = message.parts;

		let slackUser = bot.getUserForMention(receiverUsername);
		if (_.isUndefined(slackUser)) {
			slackUser = bot.getUserByName(receiverUsername);
		}

		if (_.isUndefined(slackUser)) {
			return channel.send('I`m not sure who ' + receiverUsername + ' is...');
		}

		if (isUserKarmaBanned(slackUser.name)) {
			return channel.send(bot.makeMention(slackUser) + ' is banned from receiving karma.');
		}

		let userKarma = getLeaderboard().find(o => o.receiver === slackUser.name);

		if (_.isUndefined(userKarma)) {
			return channel.send(bot.makeMention(slackUser) + ' doesn`t have any karma yet!');
		}

		channel.send(bot.makeMention(slackUser) + ' has ' + userKarma.value + ' karma. #' + userKarma.place + ' overall.');
	}

	function displayUserKarmaGiving (message, channel, user) {
		let [command, receiverUsername] = message.parts;

		let slackUser = bot.getUserForMention(receiverUsername);
		if (_.isUndefined(slackUser)) {
			slackUser = bot.getUserByName(receiverUsername);
		}

		if (_.isUndefined(slackUser)) {
			return channel.send('I`m not sure who ' + receiverUsername + ' is...');
		}

		let userKarma = getGiverLeaderboard().find(o => o.giver === slackUser.name);

		if (_.isUndefined(userKarma)) {
			return channel.send(bot.makeMention(slackUser) + ' hasn`t given any karma yet!');
		}

		channel.send(bot.makeMention(slackUser) + ' has given ' + userKarma.value + ' karma. #' +
			userKarma.place + ' overall.');
	}

	function banUser (message, channel, user) {
		let [command, subcommand, receiverUsername] = message.parts;

		let slackUser = bot.getUserForMention(receiverUsername);
		if (_.isUndefined(slackUser)) {
			slackUser = bot.getUserByName(receiverUsername);
		}

		if (_.isUndefined(slackUser)) {
			return channel.send('I`m not sure who ' + receiverUsername + ' is...');
		}

		bot.ops.isOp(user.name, (err, data) => {
			if (err) return channel.send('error! ' + err);
			if (data === 0) return channel.send('You must be an op to do that.');
			banKarma(channel, user, slackUser);

			channel.send(bot.makeMention(slackUser) + ' has been banned from receiving karma.');
		});
	}

	function unbanUser (message, channel, user) {
		let [command, subcommand, receiverUsername] = message.parts;

		let slackUser = bot.getUserForMention(receiverUsername);
		if (_.isUndefined(slackUser)) {
			slackUser = bot.getUserByName(receiverUsername);
		}

		if (_.isUndefined(slackUser)) {
			return channel.send('I`m not sure who ' + receiverUsername + ' is...');
		}

		bot.ops.isOp(user.name, (err, data) => {
			if (err) return channel.send('error! ' + err);
			if (data === 0) return channel.send('You must be an op to do that.');
			unbanKarma(slackUser.name);

			channel.send(bot.makeMention(slackUser) + ' has had karma privileges restored.');
		});
	}

	function displayBans (message, channel, user) {

		if (!karmaBans.length) return channel.send('Nobody is banned from receiving karma!');

		channel.send('The following users are banned from receiving karma: ' +
			karmaBans.map(o => bot.makeMention(bot.getUserByName(o.receiver))).join(', '));
	}

	return function init(_bot) {

		bot = _bot;
		redis = bot.redis;

		loadKarma((err, data) => {
			//console.log('loadKarma', err, data);
			if (err) return console.error(err);
			if (data === null) {
				karma = [];
				persistKarma();
			} else {
				karma = JSON.parse(data);
			}
		});

		loadKarmaBans((err, data) => {
			//console.log('loadKarmaBans', err, data);
			if (err) return console.error(err);
			if (data === null) {
				karmaBans = [];
				persistKarmaBans();
			} else {
				karmaBans = JSON.parse(data);
			}
		});

		bot.register({
			pattern: {regex: /^[A-Za-z0-9<>@]{2,21}[:,]?\s*\+1[^:]*\s*.*/g},
			f: addKarmaSucceeding,
			type: 'OUT'
		});

		bot.register({
			pattern: {regex: /^\+1[:,\s]+.+/g},
			f: addKarmaPreceding,
			type: 'OUT'
		});

		bot.register({
			pattern: {regex: /^.{3,21}[:,]?\s*\+\+/g},
			f: addKarmaPlusPlus,
			type: 'OUT'
		});

		bot.register({
			pattern: {regex: /^!karma$/g},
			f: displayLeaderboard,
			type: 'OUT'
		});

		bot.register({
			pattern: {regex: /!karma [^-]+$/g},
			f: displayUserKarma,
			type: 'OUT'});

		bot.register({
			pattern: {regex: /^!karmagiver[s]?$/g},
			f: displayGiverLeaderboard,
			type: 'OUT'
		});

		bot.register({
			pattern: {regex: /!karmagiver[s]? [^-]+$/g},
			f: displayUserKarmaGiving,
			type: 'OUT'});

		bot.register({
			pattern: {regex: /!karma -ban [^-]+$/g},
			f: banUser,
			type: 'OUT'});

		bot.register({
			pattern: {regex: /!karma -unban [^-]+$/g},
			f: unbanUser,
			type: 'OUT'});

		bot.register({
			pattern: {regex: /!karma -bans$/g},
			f: displayBans,
			type: 'OUT'});

	};

})();