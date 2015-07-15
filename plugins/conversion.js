const _ = require('lodash');

module.exports = (function() {

	let bot;

	function doConversion (message, channel) {

		let [command, ...args] = message.parts;
		let measurement, unit;

		if(!args.length){
			channel.send('Please provide something to convert.');
			return true;
		}

		//The user put a space between the measurement and the unit
		if(args.length > 1){
			measurement = args[0];
			unit = args[1].toLowerCase();
		} else {

			//Extract the measurement and units from a single string
			let measurementParts = args[0].match(/^[\d.-]+/g);
			let unitParts = args[0].match(/[^\d.-]+/g);

			if( !(measurementParts && measurementParts.length && unitParts && unitParts.length) ){
				channel.send( 'Unable to extract measurement and/or units from the given parameters');
			} else {
				measurement = measurementParts[0];
				unit = unitParts[0].toLowerCase();
			}

		}

		if( ( unit !== 'f' && unit !== 'c' ) && measurement < 0 ){
			channel.send( 'Can\'t go below 0 on that one mate...' );
			return true;
		}

		switch (unit) {
			case 'f':
				channel.send( `${measurement}°F is approximately ${convertFahrenheitToCelcius(measurement)}°C` );
				break;
			case 'c':
				channel.send( `${measurement}°C is approximately ${convertCelciusToFahrenheit(measurement)}°F` );
				break;

			case 'mm':
				channel.send( `${measurement} mm is approximately ${convertMillimetersToInches(measurement)} in.` );
				break;

			case 'in':
				channel.send( `${measurement} in is approximately ${convertInchesToMillimeters(measurement)} mm.` );
				break;

			case '"':
				channel.send( `${measurement} in is approximately ${convertInchesToMillimeters(measurement)} mm.` );
				break;

			default:
				channel.send('I did not recognize the units you wanted me to convert from.');
				break;
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
