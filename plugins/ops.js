const _ = require('lodash');

module.exports = (function(){

	let bot,
		redis;

	function initOps () {
		var defaultOps = bot.conf.get('ops') || [];
		bot.log(defaultOps);
		if (defaultOps.length) {
			_.each(defaultOps, function(item){
				redis.sadd(bot.botName + '.ops', item.toLowerCase());
			});
		}
	}

	function setOp (user) {
		redis.sadd(bot.botName + '.ops', user.toLowerCase());
	}

	function deOp (user) {
		if (_.contains(bot.conf.get('ops'), user.toLowerCase())){
			return false;
		}
		redis.srem(bot.botName + '.ops', user.toLowerCase());
		return true;
	}

	function isOp (user, callback) {
		redis.sismember(bot.botName + '.ops', user.toLowerCase(), callback);
	}

	function getOps (callback) {
		redis.smembers(bot.botName + '.ops', callback);
	}

	function listOps (message, channel) {
		getOps((err, data) => {
			if (err) return channel.send('error! ' + err);
			if (data.length) {
				data = data.map(user => bot.makeMention(bot.getUserByName(user).id));
				return channel.send('Ops are currently: ' + data.join(', '));
			} else {
				return channel.send('I have no ops :(');
			}
		});
	}

	function makeOp (message, channel, user) {
		let [command, userToOp] = message.parts;

		let slackUser = bot.getUserForMention(userToOp);
		if (_.isUndefined(slackUser)) {
			slackUser = bot.getUserByName(userToOp);
		}

		if (_.isUndefined(slackUser)) {
			return channel.send('who?');
		}

		isOp(user.name, (err, data) => {
			if (data === 0) return channel.send('You must be an op to do that.');
			isOp(slackUser.name, (err, data) => {
				if (data !== 0) return channel.send(bot.makeMention(slackUser) + ' is already an op.');
				setOp(slackUser.name);
				return channel.send(bot.makeMention(slackUser) + ' is now an op.');
			});

		});
	}

	function removeOp (message, channel, user) {
		let [command, userToDeOp] = message.parts;

		let slackUser = bot.getUserForMention(userToDeOp);
		if (_.isUndefined(slackUser)) {
			slackUser = bot.getUserByName(userToDeOp);
		}
		if (_.isUndefined(slackUser)) {
			return channel.send('who?');
		}

		isOp(user.name, (err, data) => {
			if (data === 0) return channel.send('You must be an op to do that.');
			isOp(slackUser.name, (err, data) => {
				if (data === 0) return channel.send(bot.makeMention(slackUser) + ' isn`t an op...');
				deOp(slackUser.name);
				return channel.send(bot.makeMention(slackUser) + ' is no longer an op.');
			});

		});
	}

	function pauseChannel (message, channel, user) {

		let [command, botname] = message.parts;

		 //you should be able to default the value in the destructuring, and babel takes that, but intellij doesnt approve
		botname = botname || '';

		let slackUser = bot.getUserForMention(botname);
		if (_.isUndefined(slackUser)) {
			slackUser = bot.getUserByName(botname);
		}

		if (_.isUndefined(slackUser) || slackUser.name !== bot.botName) {
			return channel.send('are you talking to me? use `' + command + ' @' + bot.botName + '`');
		}

		bot.pauseChannel(channel, user);
	}

	function playChannel (message, channel, user) {

		let [command, botname] = message.parts;

		 //you should be able to default the value in the destructuring, and babel takes that, but intellij doesnt approve
		botname = botname || '';

		let slackUser = bot.getUserForMention(botname);
		if (_.isUndefined(slackUser)) {
			slackUser = bot.getUserByName(botname);
		}

		if (_.isUndefined(slackUser) || slackUser.name !== bot.botName) {
			return channel.send('are you talking to me? use `' + command + ' @' + bot.botName + '`');
		}

		bot.playChannel(channel, user);
	}

	return function init (_bot) {
		bot = _bot;
		redis = bot.redis;

		initOps();

		bot.ops = {
			setOp: setOp
			,deOp: deOp
			,isOp: isOp
			,getOps: getOps
		};

		bot.register({
			pattern: {command: '!ops'},
			f: listOps,
			type: 'OUT'
		});

		bot.register({
			pattern: {command: '!op'},
			f: makeOp,
			type: 'OUT'
		});

		bot.register({
			pattern: {command: '!deop'},
			f: removeOp,
			type: 'OUT'
		});

		bot.register({
			pattern: {command: '!pause'},
			f: pauseChannel,
			type: 'OUT'
		});

		bot.register({
			pattern: {command: '!play'},
			f: playChannel,
			type: 'OUT',
			flags: {ignorePaused: true}
		});

		bot.register({
			pattern: {command: '!unpause'},
			f: playChannel,
			type: 'OUT',
			flags: {ignorePaused: true}
		});

	};


})();