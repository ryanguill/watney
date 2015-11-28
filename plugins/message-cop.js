'use strict';

module.exports = (function(){
	const _ = require('lodash');
	const moment = require('moment');
	const request = require('request');

	let bot;
	let config;
	let redis;

	let maxLineBreaksPerMessage;

	function createGist (channel, username, messageText, callback) {

		const filename = channel + '-' + username + '-dump.txt';

		const formData = {
			description: 'Long message posted to ' + channel + ' by ' + username,
			public: false,
			files: {}
		};

		formData.files[filename] = {content: messageText};

		console.log(JSON.stringify(formData));

		request({
			method: 'POST',
			url: 'https://api.github.com/gists',
			headers: {'user-agent': 'https://github.com/ryanguill/watney'},
			form: JSON.stringify(formData)}, callback);
	}

	function checkMessageLineBreaks (message, channel, user) {

		let lines = message.text.split('\n');

		if (lines.length > maxLineBreaksPerMessage) {
			//create a gist of the message
			createGist(channel.name, user.name, message.text, (err, response, body) => {
				if (err) {
					console.error(err);
					return channel.send('error! ' + err);
				}
				const data = JSON.parse(body);
				const gistURL = data.html_url;

				//get a dm for the user
				const dm = bot.getChannelGroupOrDMByName(user.name);
				dm.send('Hello there! I noticed you tried to post a long message to ' +
						bot.makeChannelMention(channel) +'. Please ' +
						'consider using a service to host that data and then provide a link instead. ' +
						'https://gist.github.com/ and http://pastebin.com/ are the most popular options. ' +
						'I have copied your post into an anonymous gist here so that you won`t lose any work: ' +
						gistURL + ' - you can share that link in ' + bot.makeChannelMention(channel) +
						' if that works for you.\n' +
						'_Please let an admin know if you think you received this message in error_');

				message.deleteMessage.call(message);
			});

		}
	}

	return function init( _bot, _config) {
		bot = _bot;
		config = _config;
		redis = bot.redis;

		maxLineBreaksPerMessage = config.maxLineBreaksPerMessage || 5;

		console.log(config, maxLineBreaksPerMessage);

		bot.register({pattern: {},
			f: checkMessageLineBreaks,
			type: 'IN'});

	};
})();
