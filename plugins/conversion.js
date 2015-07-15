const _ = require('lodash');

module.exports = (function() {

	let bot;

	function doConversion (message, channel) {

		let [command, ...args] = message.parts;
		let measurement, unit;

		if(!args.length){
			channel.send('Please provide something to convert.');
		} else {
			//The user put a space between the measurement and the units
			if(args.length > 1){
				measurement = args[0];
				unit = args[1];
			} else {

				//Extract the measurement and units from a single string
				let measurements = args[0].match(/^[\d.]+/g);
				let units = args[0].match(/[^\d.]+/g);

				if( !(measurements.length && units.length) ){
					channel.send( 'Unable to extract measurement and/or units from the given parameters');
				} else {
					measurement = measurements[0];
					unit = units[0];
				}

			}

			switch (unit) {
				case 'f':
					channel.send( measurement + ' degrees fahrenheit is approximately ' + convertFahrenheitToCelcius(measurement) + ' degrees celcius.' );
					break;
				case 'c':
					channel.send( measurement + ' degrees celcius is approximately ' + convertCelciusToFahrenheit(measurement) + ' degrees fahrenheit.' );
					break;

				case 'mm':
					channel.send( measurement + ' millimeters is approximately ' + convertMillimetersToInches(measurement) + ' inches.' );
					break;

				case 'in':
					channel.send( measurement + ' inches is approximately ' + convertInchesToMillimeters(measurement) + ' millimeters.' );
					break;

				case '"':
					channel.send( measurement + ' inches is approximately ' + convertInchesToMillimeters(measurement) + ' millimeters.' );
					break;

				default:
					channel.send('I did not recognize the units you wanted me to convert from.');
					break;
			}

		}

	}

	function convertCelciusToFahrenheit(degrees){
		return Math.round( ((degrees*9)/5)+32 );
	}

	function convertFahrenheitToCelcius(degrees){
		return Math.round( ((degrees-32)*5)/9 );
	}

	function convertMillimetersToInches( mm ){
		return Math.round(( (mm * 0.0393701) + 0.00001) * 100) / 100;
	}

	function convertInchesToMillimeters( inches ){
		return Math.round(( (inches * 25.4) + 0.00001) * 100) / 100;
	}

	return function init (_bot) {
		bot = _bot;

		bot.register({
			pattern: {startsWith: '!convert'},
			f: doConversion,
			type: 'OUT',
			eventType: 'message',
			priority: 1000,
			flags: {}
		});

	};


})();
