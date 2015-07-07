const _ = require('lodash');

module.exports = (function(){

	let bot,
		reDice = /([1-9][0-9]{0,2})(d|D)([1-9][0-9]{0,3})((\+|-|\*|\/)([0-9]{1,3}))?( *(&[g|l]t;=?|=) *[0-9]*)?/g,
		reMessage = /(^(!roll )[1-9][0-9]{0,2})(d|D)([1-9][0-9]{0,3})((\+|-|\*|\/)([0-9]{1,3}))?/g;

	function checkTarget(result, quantifier, target) {
		let text = ' Failure!',
			quantifiers = {
				'&gt;': (a,b) => a>b,
				'&lt;': (a,b) => a<b,
				'&gt;=': (a,b) => a>=b,
				'&lt;=': (a,b) => a<=b,
				'=': (a,b) => a===b
			};
		if (quantifiers[quantifier.toLowerCase()](parseFloat(result), parseFloat(target))) text = ' Success!';
		return text;
	}

	function rollDice (dice) {
		let result = 0,
			[throws, sides] = dice.split('d'),
			aResults = [];
		for (let i = 0; i < throws; i++){
			let roll = Math.floor((Math.random() * sides) + 1);
			result += roll;
			aResults.push(roll);
		}
		return {
			result: result,
			rolls: aResults
		};
	}

	function diceCalculation (result, operator, modifier) {
		let operators = {
			'+': (a,b) => a+b,
			'-': (a,b) => a-b,
			'/': (a,b) => a/b,
			'*': (a,b) => a*b
		};

		return operators[operator](parseFloat(result), parseFloat(modifier));
	}

	function procDice (message, channel, user) {
		let aDiceRolls = message.text.match(reDice),
			aResults = [],
			returnMessage = bot.makeMention(user) + ': You rolled:';
		for (let element of aDiceRolls) {
			let [diePart, quantifier, target] = element.split(/(&[g|l]t;=*|=)/g),
				[die, operator, modifier] = diePart.split(/(\+|-|\*|\/)/g),
				roll = rollDice(die);
			if (operator) roll.result = diceCalculation(roll.result, operator, modifier);
			roll.target = '';
			if (quantifier && target) roll.target = checkTarget(roll.result, quantifier, target);
			returnMessage += ' ( ' + element + ' ) = ' + roll.result + ' [' + roll.rolls.toString() +
				']' + roll.target;
		}
		channel.send(returnMessage);
	}

	return function init (_bot) {
		bot = _bot;

		bot.register({
			pattern: {regex: reMessage},
			f: procDice,
			type: 'OUT'
		});
	};
})();