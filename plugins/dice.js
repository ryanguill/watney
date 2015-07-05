const _ = require('lodash');

module.exports = (function(){

	let bot;
	let reDice = new RegExp(/([1-9][0-9]{0,2})(d|D)([1-9][0-9]{0,3})((\+|-|\*|\/)([0-9]{1,3}))?/g);

	function rollDice (dice) {
		let result = 0,
			aDice = dice.split('d'),
			aResults = [];
		for (let i = 0; i < aDice[0]; i++){
			let roll = Math.floor((Math.random() * aDice[1]) + 1);
			result = result + roll;
			aResults.push(roll);
		}
		return {
			result: result,
			rolls: aResults
		};
	}

	function diceCalculation (result, operator, modifier) {
		let operators = {
			'+': function(a, b) { return a + b; },
			'-': function(a, b) { return a - b; },
			'/': function(a, b) { return a / b; },
			'*': function(a, b) { return a * b; }
		};

		return operators[operator](parseFloat(result), parseFloat(modifier));
	}

	function procDice (message, channel, user) {
		let aDiceRolls = message.text.match(reDice),
			aResults = [],
			returnMessage = bot.makeMention(user) + ': You rolled:';

		for (let element of aDiceRolls) {
			let aBits = element.split(/(\+|-|\*|\/)/g),
				roll = rollDice(aBits[0]);
			if (aBits.length === 3) roll.result = diceCalculation(roll.result, aBits[1], aBits[2]);
			returnMessage = returnMessage + ' ' + element + ' = ' + roll.result + ' [' + roll.rolls.toString() + ']';
		}
		channel.send(returnMessage);
	}

	return function init (_bot) {
		bot = _bot;

		bot.register({
			pattern: {regex: reDice},
			f: procDice,
			type: 'OUT',
			eventType: 'message',
			priority: 900,
			flags: { stop:true }
		});
	};
})();