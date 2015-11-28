const _ = require('lodash');
const sys = require('sys');
const exec = require('child_process').exec;

module.exports = (function(){

	let bot;
	let redis;
	let child;
	let restartTimestampKey;

	function killSelf (message, channel, user) {

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

		bot.ops.isOp(user.name, (err, data) => {
			if (err) return channel.send('error! ' + err);
			if (data === 0) return channel.send('http://i.imgur.com/4C7iu09.gif');
			channel.send('restarting...');
			redis.set(restartTimestampKey, JSON.stringify({ts: _.now(), channelName: channel.name}));
			setTimeout(() => process.exit(1), 2000);
		});

	}

	function doDeploy (message, channel, user) {

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

		bot.ops.isOp(user.name, (err, data) => {
			if (err) return channel.send('error! ' + err);
			if (data === 0) return channel.send('http://i.imgur.com/4C7iu09.gif');
			channel.send('deploying...');

			child = exec('./extra/deploy.sh', (err, stdout, stderr) => {
				channel.send('stdout: ```' + stdout + ' ```');
				channel.send('stderr ```' + stderr + ' ```');
				if (err) return channel.send('error! ' + err);
			});

		});
	}

	function checkRestart () {
		redis.get(restartTimestampKey, (err, data) => {
			if (err) throw(err);
			if (data !== null) {
				let {ts, channelName} = JSON.parse(data);
				let diff = _.now() - ts;
				let channel = bot.getChannelGroupOrDMByName(channelName);
				channel.send('And we`re back! restart time: ' + (diff / 1000) + ' seconds');
			}
			redis.del(restartTimestampKey);
		});
	}

	return function init(_bot) {
		bot = _bot;
		redis = bot.redis;

		restartTimestampKey = bot.botName + '.restart_ts';

		bot.on('joined', checkRestart);

		bot.register({
			pattern: {command: '!restart'},
			f: killSelf,
			type: 'OUT'
		});

		bot.register({
			pattern: {command: '!deploy'},
			f: doDeploy,
			type: 'OUT'
		});
	};

})();