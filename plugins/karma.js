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
		persistKarmaBans();
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
		let receivers = _.uniq(_.map(karma, 'receiver'));
		//let sumByReceiver = _.map(_.map(receivers, getUserKarma), karmaList => karmaList.length);
		let sumByReceiver = receivers.map(r => {
			return {handle: r, value: getUserKarma(r).length, valueStr: getUserKarma(r).length};
		});

		sumByReceiver = _.sortBy(sumByReceiver, 'value').reverse();
		let uniqueScores = _.uniq(_.map(sumByReceiver, 'value'));

		sumByReceiver = sumByReceiver.map((o, index) => {
			o.place = uniqueScores.findIndex(x => x === o.value) + 1;
			return o;
		});

		return sumByReceiver;
	}

	function getGiverLeaderboard () {
		let givers = _.uniq(_.map(karma, 'giver'));

		let sumByGiver = givers.map(r => {
			return {handle: r, value: getUserKarmaGiving(r).length, valueStr: getUserKarmaGiving(r).length};
		});

		sumByGiver = _.sortBy(sumByGiver, 'value').reverse();
		let uniqueScores = _.uniq(_.map(sumByGiver, 'value'));

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
			//removing for now, might put back if the user used an @
			//return channel.send('I`m not sure who ' + receiverUsername + ' is...');
			return;
		}

		if (slackUser.name === user.name) {
			return channel.send('You can\'t give karma to yourself ಠ_ಠ');
		}

		if (isUserKarmaBanned(slackUser.name)) {
			return channel.send(bot.makeMention(slackUser) + ' is banned from receiving karma.');
		}

		giveKarma(channel, user, slackUser);

		let userKarma = getLeaderboard().find(o => o.handle === slackUser.name);

		return channel.send('`' + bot.makeMention(user) + ' gives karma to ' + bot.makeMention(slackUser) +
			'. They now have ' + userKarma.value + ' karma. #' + userKarma.place + ' overall.`');
	}

	function addKarmaSucceeding (message, channel, user) {
		let username = _.first(message.parts).replace(/[:,\s+]/g, '').trim();

		channel.is_im = channel.is_im || false;
		if (channel.is_im) {
			return channel.send('You can not give karma in Direct Messages');
		}

		addKarma(message, channel, user, username);
	}

	function addKarmaPreceding (message, channel, user) {
		let username = _.first(message.text.replace(/\+1[:,]*/g, '').trim().split(' '));

		channel.is_im = channel.is_im || false;
		if (channel.is_im) {
			return channel.send('You can not give karma in Direct Messages');
		}

		addKarma(message, channel, user, username);
	}

	function addKarmaPlusPlus (message, channel, user) {
		let username = _.first(message.text.replace(/[:,]?\s*\+\+/g, '').trim().split(' '));

		channel.is_im = channel.is_im || false;
		if (channel.is_im) {
			return channel.send('You can not give karma in Direct Messages');
		}

		addKarma(message, channel, user, username);
	}

	function displayLeaderboard (message, channel, user) {
		let leaderboard = getLeaderboard();
		let board = calculateLeaderboard( leaderboard );
		channel.send( `ƙarma leaderboard:\`\`\`${board}\`\`\`` );
	}

	function displayGiverLeaderboard (message, channel, user) {
		let leaderboard = getGiverLeaderboard();
		let board = calculateLeaderboard( leaderboard );
		channel.send( `ƙarma-givers leaderboard:\`\`\`${board}\`\`\`` );
	}

	function calculateLeaderboard(data){
		let top10 = data.reduce((agg, o) => {
			//I think there is a _. method to make this cleaner, defaults or something, I need to look it up
			agg[ o.place ] = agg[ o.place ] || [];
			agg[ o.place ].push( o );
			return agg;
		}, {});

		let board = '';
		let sum = 0, totalHandles = 0;

		for (let place of [1,2,3,4,5,6,7,8,9,10]){
			if (_.has(top10, place)){
				let karmaAmount = _.first(top10[ place ]).valueStr;
				let handles = _.map(top10[ place ], 'handle');
				sum += (karmaAmount * handles.length);
				totalHandles += handles.length;
				board += `\n[ #${place} @ ${karmaAmount}ƙ ]: ${handles.join(', ')}`;
			}
		}

		board += `\n[ Total: ${sum}ƙ / ${totalHandles} user${totalHandles === 1 ? '' : 's'} ]`;

		return board;
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

		let leaderboardPos = getLeaderboard().find(o => o.handle === slackUser.name);

		if (_.isUndefined(leaderboardPos)) {
			return channel.send(bot.makeMention(slackUser) + ' doesn`t have any karma yet!');
		}

		let givers = _.countBy(_.map(_.filter(karma, {'receiver': slackUser.name}), 'giver'));
		givers = _.sortBy(_.map(givers, (value, giver) => {return {giver: giver, amount: value};}), 'amount').reverse();

		let giverUniqueScores = _.uniq(_.map(givers, 'amount'));

		let giverLeaderBoard = givers.map((o, index) => {
			o.handle = o.giver;
			o.valueStr = o.amount.toString();
			o.place = giverUniqueScores.findIndex(x => x === o.amount) + 1;
			return o;
		});

		let giversBoard = calculateLeaderboard(giverLeaderBoard);


		let receivers = _.countBy(_.map(_.filter(karma, {'giver': slackUser.name}), 'receiver'));

		receivers = _.sortBy(_.map(receivers, (value, receiver) => {
			return {receiver: receiver, amount: value};
		}), 'amount').reverse();

		let receiverUniqueScores = _.uniq(_.map(receivers, 'amount'));

		let receiverLeaderBoard = receivers.map((o, index) => {
			o.handle = o.receiver;
			o.valueStr = o.amount.toString();
			o.place = receiverUniqueScores.findIndex(x => x === o.amount) + 1;
			return o;
		});

		let receiversBoard = calculateLeaderboard(receiverLeaderBoard);

		if (giverLeaderBoard.length === 0) {
			giversBoard = '';
		}

		if (receiverLeaderBoard.length === 0) {
			receiversBoard = '';
		}

		channel.send('`' + bot.makeMention(slackUser) + ' has ' + leaderboardPos.value + ' karma. #' + leaderboardPos.place +
				' overall.`\n' +
				'```Users giving karma to ' + slackUser.name + ' are:' + giversBoard + '```\n' +
				'```Users receiving karma from ' + slackUser.name + ' are:' + receiversBoard + '```\n');
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

		let userKarma = getGiverLeaderboard().find(o => o.handle === slackUser.name);

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
			karmaBans.map(o => bot.getUserByName(o.receiver).name).join(', '));
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
