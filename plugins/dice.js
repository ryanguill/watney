const _ = require('lodash');

module.exports = (function(){

	let bot,
		reDice = /([1-9][0-9]{0,2})(d|D)([1-9][0-9]{0,3})((\+|-|\*|\/)([0-9]{1,3}))?( *\&(g|G|l|L)t\; *[0-9]*)?/g,
		reMessage = /(^(\!roll )[1-9][0-9]{0,2})(d|D)([1-9][0-9]{0,3})((\+|-|\*|\/)([0-9]{1,3}))?/g;

	function checkTarget(result, quantifier, target) {
		let text = '';
		if (quantifier === '&gt;') {
			if (result > target) {
				text = ' Success! ' + result + ' is higher than ' + target;
			} else {
				text = ' Failure! ' + result + ' is lower than ' + target;
			}
		} else if (quantifier === '&lt;') {
			if (result < target) {
				text = ' Success! ' + result + ' is lower than ' + target;
			} else {
				text = ' Failure! ' + result + ' is higher than ' + target;
			}
		} else {
			text = ' We just dont know!';
		}
		return text;
	}

	function rollDice (dice) {
		let result = 0,
			[throws, sides] = dice.split('d'),
			aResults = [];
		for (let i = 0; i < throws; i++){
			let roll = Math.floor((Math.random() * sides) + 1);
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
			let [diePart, quantifier, target] = element.split(/(&[g|G|l|L]t;)/g),
				[die, operator, modifier] = diePart.split(/(\+|-|\*|\/)/g),
				roll = rollDice(die);
			console.log({
				diepart: diePart,
				quantifier: quantifier,
				target: target,
				die: die,
				operator: operator,
				modifier: modifier
			});
			if (operator) roll.result = diceCalculation(roll.result, operator, modifier);
			if (quantifier && target) roll.target = checkTarget(roll.result, quantifier, target);
			roll.target = roll.target || '';
			returnMessage = returnMessage + ' ' + element + ' = ' + roll.result + ' [' + roll.rolls.toString() +
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