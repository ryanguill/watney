const _ = require('lodash');
const moment = require('moment');

module.exports = (function(){

	let bot,
		redis,
		currentRaffle,
		tickets = [];

	function getRaffle (callback) {
		redis.get(bot.botName + '.raffle', callback);
	}

	function setRaffle (desc, cooldown) {
		currentRaffle = {desc: desc, cooldown: cooldown};
		redis.set(bot.botName + '.raffle', JSON.stringify(currentRaffle));
	}

	function getTickets (callback) {
		redis.get(bot.botName + '.raffle_tickets', callback);
	}

	function persistTickets () {
		redis.set(bot.botName + '.raffle_tickets', JSON.stringify(tickets));
	}

	function clearTickets () {
		tickets = [];
		persistTickets();
	}


	function displayRaffle (message, channel, user) {
		if (!_.isUndefined(currentRaffle)) {

			let uniqueTicketHolderCount = getUniqueTicketMembers().length;
			channel.send(currentRaffle.desc + '\nDirect message ' + bot.makeMention(bot.getUserByName(bot.botName)) +
				' the command `!ticket` to enter.');
			if (currentRaffle.cooldown === -1) {
				channel.send('You can only enter once.');
			} else {
				channel.send('You can enter every ' +
					moment.duration(currentRaffle.cooldown, 'minutes').humanize().replace('an ', '').replace('a ', ''));
			}
			channel.send('I have given out ' + tickets.length + ' ticket' + (tickets.length !== 1 ? 's' : '') + ' to ' +
				uniqueTicketHolderCount + ' different member' + (uniqueTicketHolderCount !== 1 ? 's' : '') + '!');
			return;
		}

		return channel.send('There is no active raffle at this time.');
	}

	function createRaffle (message, channel, user) {
		let [command, createCommand, ...desc] = message.parts;


		if (!_.isUndefined(currentRaffle)) {
			return channel.send('There is already an active raffle! use `!raffle` to check it out.\n' +
				'Check the docs for more options.');
		}

		if (!desc.length) {
			return channel.send('You have to give me a description.  Try `!raffle -create {description}`');
		}

		desc = desc.join(' ').replace(/[<>]/, '');

		bot.ops.isOp(user.name, (err, data) => {
			if (err) return channel.send('error! ' + err);
			if (data === 0) return channel.send('You must be an op to do that.');

			setRaffle(desc, 60);

			return channel.send('Ok, raffle created! Good Luck to everyone!');
		});
	}

	function resetRaffle (message, channel, user) {

		bot.ops.isOp(user.name, (err, data) => {
			if (err) return channel.send('error! ' + err);
			if (data === 0) return channel.send('You must be an op to do that.');

			redis.del(bot.botName + '.raffle');
			currentRaffle = undefined;
			clearTickets();
			return channel.send('Ok, raffle cleared.');
		});

	}

	function rafflePick (message, channel, user) {

		function randomReply (user) {
			let replies = [
				`${bot.makeMention(user)} come on down!`,
				`${bot.makeMention(user)} I choose you!`,
				`Congratulations ${bot.makeMention(user)}!`,
				`${bot.makeMention(user)} winner, winner chicken dinner!`
			];

			return replies[_.random(0, replies.length - 1)];
		}


		bot.ops.isOp(user.name, (err, data) => {
			if (err) return channel.send('error! ' + err);
			if (data === 0) return channel.send('You must be an op to do that.');


			let winnerIndex = _.random(0, tickets.length - 1);
			let winner = tickets[winnerIndex];

			return channel.send(randomReply(bot.getUserByName(winner.user)));
		});

	}

	function setCooldown (message, channel, user) {
		let [command, subcommand, cooldown] = message.parts;

		cooldown = Number(cooldown);

		if (_.isUndefined(cooldown) || !_.isFinite(cooldown) || (cooldown < 1 && cooldown !== -1)) {
			return channel.send('I need a proper cooldown value.  Try `!raffle -cooldown {cooldown}` with an integer, or' +
				' -1 to only allow one vote per user.');
		}

		if (_.isUndefined(currentRaffle)) {
			return channel.send('There is no active raffle - create one first.');
		}

		bot.ops.isOp(user.name, (err, data) => {
			if (err) return channel.send('error! ' + err);
			if (data === 0) return channel.send('You must be an op to do that.');

			setRaffle(currentRaffle.desc, cooldown);

			return channel.send('Raffle cooldown updated.');
		});
	}


	function updateRaffle (message, channel, user) {
		if (_.isUndefined(currentRaffle)) {
			return channel.send('There is no active raffle - create one first.');
		}

		let [command, createCommand, ...desc] = message.parts;

		if (!desc.length) {
			return channel.send('You have to give me a new description.  Try `!raffle -update {description}`');
		}

		desc = desc.join(' ').replace(/[<>]/, '');

		bot.ops.isOp(user.name, (err, data) => {
			if (err) return channel.send('error! ' + err);
			if (data === 0) return channel.send('You must be an op to do that.');

			setRaffle(desc, currentRaffle.cooldown);

			return channel.send('Raffle description updated.');
		});
	}

	function getTicket (message, channel, user) {

		//make sure this is a DM.
		channel.is_im = channel.is_im || false;
		if (!channel.is_im) {
			return channel.send('You can only get a ticket in a Direct Message to ' +
				bot.makeMention(bot.getUserByName(bot.botName)));
		}

		if (_.isUndefined(currentRaffle)) {
			return channel.send('There is no active raffle!');
		}

		let lastTicket = getUserLastTicket(user);
		//todo: this needs to be cleaned up, probably refactored into functions
		if (_.isUndefined(lastTicket) || ((_.now() - lastTicket.ts) > currentRaffle.cooldown * 60 * 1000) &&
			currentRaffle.cooldown !== -1) {
			tickets.push({user: user.name, ts: _.now()});
			persistTickets();
			//todo: would like to find a way to do /me
			channel.send(bot.botName + ' gives ' + user.name + ' a ticket.');
		} else {
			if (currentRaffle.cooldown === -1) {
				return channel.send('You can only get one ticket for this raffle, but you`re entered!');
			} else {
				channel.send('You can`t get another ticket yet! You must wait ' +
					moment.duration(currentRaffle.cooldown * 60 * 1000 - (_.now() - lastTicket.ts)).humanize());
				channel.send(currentRaffle.cooldown * 60 * 1000 - (_.now() - lastTicket.ts) + 'ms');

			}
		}

		var ticketCount = getUserTickets(user).length;

		return channel.send('You have ' + ticketCount + ' ticket' + (ticketCount !== 1 ? 's' : ''));

	}

	function getUserTickets (user) {
		if (_.isObject(user)) {
			user = user.name;
		}
		return _.filter(tickets, {user: user});
	}

	function getUserLastTicket (user) {
		if (_.isObject(user)) {
			user = user.name;
		}
		return _.first(_.sortBy(getUserTickets(user), 'ts').reverse());
	}

	function getUniqueTicketMembers () {
		return _.uniq(_.pluck(tickets, 'user'));
	}

	function getCounts () {
		let users = _.uniq(_.pluck(tickets, 'user'));

		let sumByUser = users.map(u => {
			return {user: u, value: getUserTickets(u).length};
		});

		sumByUser = _.sortBy(sumByUser, 'value').reverse();
		let uniqueCounts = _.uniq(_.pluck(sumByUser, 'value'));

		sumByUser = sumByUser.map((o, index) => {
			o.place = uniqueCounts.findIndex(x => x === o.value) + 1;
			return o;
		});

		return sumByUser;
	}

	function listTickets (message, channel, user) {

		//make sure this is a DM.
		channel.is_im = channel.is_im || false;
		if (!channel.is_im) {
			return channel.send('You can only get this information in a Direct Message to ' +
				bot.makeMention(bot.getUserByName(bot.botName)));
		}

		let counts = getCounts();

		let ordered = counts.reduce((agg, o) => {
			agg[ o.place ] = agg[ o.place ] || [];
			agg[ o.place ].push( o );
			return agg;
		}, {});

		let board = '';
		for (let place of [1,2,3,4,5,6,7,8,9,10]){
			if (_.has(ordered, place)){
				let value = _.first(ordered[ place ]).value;
				let usersList = _.pluck(ordered[ place ], 'user').join(', ');
				board += `\n[${value} ticket${value !== 1 ? 's' : ''}]: ${usersList}`;
			}
		}

		channel.send( `\`\`\`${board}\nTotal ticket holders: ${counts.length}\`\`\`` );
	}

	return function init (_bot) {
		bot = _bot;
		redis = bot.redis;

		getRaffle((err, data) => {
			if (err) console.error('error getting raffle ' + err);
			if (data) {
				currentRaffle = JSON.parse(data);
			} else {
				currentRaffle = undefined;
			}

			getTickets((err, data) => {
				if (err) console.error('error getting tickets ' + err);
				if (data) {
					tickets = JSON.parse(data);
				} else {
					clearTickets();
				}
			});
		});

		bot.register({
			pattern: {regex: /^!raffle$/gi},
			f: displayRaffle,
			type: 'OUT'
		});

		bot.register({
			pattern: {regex: /^!raffle -create/gi},
			f: createRaffle,
			type: 'OUT'
		});

		bot.register({
			pattern: {regex: /^!raffle -update/gi},
			f: updateRaffle,
			type: 'OUT'
		});

		bot.register({
			pattern: {regex: /^!raffle -reset$/gi},
			f: resetRaffle,
			type: 'OUT'
		});

		bot.register({
			pattern: {regex: /^!raffle -pick/gi},
			f: rafflePick,
			type: 'OUT'
		});

		bot.register({
			pattern: {regex: /^!raffle -cooldown/gi},
			f: setCooldown,
			type: 'OUT'
		});

		bot.register({
			pattern: {regex: /^!ticket$/gi},
			f: getTicket,
			type: 'OUT'
		});

		bot.register({
			pattern: {regex: /^!raffle -listTickets$/gi},
			f: listTickets,
			type: 'OUT'
		});







	};


})();
