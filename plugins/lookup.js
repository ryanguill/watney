const request = require('request');
const _ = require('lodash');

module.exports = (function() {

	let bot,
		redis;

	function docsApi (term, callback){
		const base = 'https://raw.githubusercontent.com/foundeo/cfdocs/master/data/en/';
		const full = base + term + '.json';

		request(full, function (error, response, body) {
			if ( !error && response.statusCode === 200 ) {
				try {
					const r = JSON.parse(body);
					callback(null, r);
				} catch (e) {
					callback('Error Parsing JSON for `' + term + '`', null);
				}
			} else if ( response.statusCode === 404 ){
				callback( 'Unable to find docs for `' + term + '`', null );
			}
		});
	}

	function createGist (filename, data, callback) {

		const formData = {
			description: 'Custom Descriptions from ' + bot.botName,
			public: false,
			files: {}
		};

		formData.files[filename] = {content: data};

		request.post({
			url: 'https://api.github.com/gists',
			headers: {'user-agent': 'https://github.com/ryanguill/watney'},
			form: JSON.stringify(formData)}, callback);
	}

	function loghit (channelName, term) {
		redis.hincrby(bot.botName + '.' + channelName + '.lookup_hits', term.toLowerCase(), 1);
		redis.hincrby(bot.botName + '.' + channelName + '.lookup_hits', 'TOTAL', 1);
	}

	function setDesc (term, desc) {
		redis.hset(bot.botName + '.customLookup', term.toLowerCase(), desc);
	}

	function getDesc (term, callback) {
		redis.hget(bot.botName + '.customLookup', term.toLowerCase(), callback);
	}

	function clearDesc (term) {
		redis.hdel(bot.botName + '.customLookup', term.toLowerCase());
	}

	function getCustomDescriptions (callback) {
		redis.hgetall(bot.botName + '.customLookup', callback);
	}

	function getHits (channelName, term, callback) {
		redis.hget(bot.botName + '.' + channelName + '.lookup_hits', term.toLowerCase(), callback);
	}

	function getTotalHits (channelName, callback) {
		redis.hget(bot.botName + '.' + channelName + '.lookup_hits', 'TOTAL', callback);
	}

	function getLeaderboard(channelName, callback) {
		redis.hgetall(bot.botName + '.' + channelName + '.lookup_hits', callback);
	}

	function resetHits(channelName) {
		redis.del(bot.botName + '.' + channelName + '.lookup_hits');
	}

	function doLookup (message, channel) {
		let term = _.rest(message.text.split('')).join('').toLowerCase();
		//bot.log('term', term);

		if (term.length === 0) return;

		loghit(channel.name, term);
		getDesc(term, (err, result) => {
			if (result !== null) {
				channel.send(result);
			} else {
				docsApi(term, function(err, result){
					if (err !== null){
						channel.send('error: ' + err);
					} else {
						const theoreticalMax = 2000; //rough guess at how many characters we get
						const link = ' // http://cfdocs.org/' + term;
						let msg = '`';

						if (result.type === 'tag'){
							msg += result.syntax + ' -- ' + result.description.replace(/\s+/g, ' ') + '`';
						}else{
							msg += result.syntax + ' -- returns ' + (result.returns.length ? result.returns : ' nothing') + '`';
						}

						let bufferRemaining = theoreticalMax - ( (bot.botName.length + 1) + link.length);
						let fitMsg = msg.substr(0, bufferRemaining);
						if (fitMsg !== msg){
							fitMsg = fitMsg + '...';
						}
						fitMsg = fitMsg + link;

						if (!_.isUndefined(result.discouraged)) {
							fitMsg += ' *DISCOURAGED! ' + result.discouraged + '*';
						}

						if (_.any(result.engines, engine => _.has(engine, 'removed'))) {
							fitMsg += ' *REMOVED in at least one engine!*';
						} else if (_.any(result.engines, engine => _.has(engine, 'deprecated'))) {
							fitMsg += ' *DEPRECATED in at least one engine!*';
						}

						channel.send(fitMsg);
					}
				});
			}
		});
	}

	function setLookup (message, channel, user) {
		let [term, command, ...desc] = message.parts;
		term = _.rest(term.split('')).join('').toLowerCase();
		desc = desc.join(' ');

		//clean up description
		desc = desc.replace('<','').replace('>','');

		//bot.log('term', term);
		//bot.log('desc', desc);

		bot.ops.isOp(user.name, (err, data) => {
			if (err) return channel.send('error! ' + err);
			if (data === 0) return channel.send('You must be an op to do that.');
			setDesc(term, desc);
			channel.send('New description saved for `' + term + '`');
		});
	}

	function importLookups (message, channel, user) {
		let [command, subcommand, url] = message.parts;
		url = _.first(url.replace('<','').replace('>','').split('|'));
		bot.log(url);

		bot.ops.isOp(user.name, (err, data) => {
			if (err) return channel.send('error! ' + err);
			if (data === 0) return channel.send('You must be an op to do that.');

			request(url, function (error, response, body) {
				if ( !error && response.statusCode === 200 ) {
					try {
						const data = JSON.parse(body);
						//console.log(data);

						_.forEach(data, (desc, term) => setDesc(term, desc));
						return channel.send('All imported captain. ' + _.keys(data).length + ' of them in all.');

					} catch (e) {
						return channel.send('Error Parsing JSON for `' + url + '`');
					}
				} else if ( response.statusCode === 404 ){
					return channel.send('404 mate...');
				}
			});

		});
	}

	function exportLookups (message, channel, user) {
		let [command, subcommand, format] = message.parts;

		if (_.isUndefined(format)) {
			return channel.send('You must provide a format: `!lookup -export [md|markdown|text|json]` - only json can be imported.');
		}

		getCustomDescriptions((err, data) => {
			console.log(err, data);
			if (err) {
				console.error(err);
				return channel.send('Error! ' + err);
			}

			if (data === null) {
				console.log(err, data);
				return channel.send('data was null...');
			}

			let filename = bot.botName + '-custom-descriptions.';
			let output = '';
			let keys = _.keys(data).sort();

			switch (format) {
				case 'md' :
				case 'markdown' :
					filename += 'md';
					output = _.map(keys, key => '```' + decodeURI(key) + '``` ' + decodeURI(data[key])).join('\n\n');
					break;
				case 'text' :
					filename += 'text';
					output = _.map(keys, key => decodeURI(key) + ': ' + decodeURI(data[key])).join('\n');
					break;
				case 'json' :
					filename += 'json';
					output = JSON.stringify(data);
					break;
				default :
					return channel.send('I don`t understand that export format.  You can export to markdown, text or json');
					break;
			}

			createGist(filename, output, function (err, response, body) {
				if (err) {
					console.error(err);
					return channel.send('Error: ' + err);
				}
				try {
					var data = JSON.parse(body);
					if (_.has(data, 'message') && _.has(data, 'documentation_url')) {
						return channel.send('error: ' + body);
					} else {
						switch (format) {
							case 'md' :
							case 'markdown' :
								return channel.send('Custom descriptions: ' + data.html_url);
								break;
							case 'text' :
								return channel.send('Custom descriptions: ' + data.files[filename].raw_url);
								break;
							case 'json' :
								return channel.send('Custom descriptions: ' + data.files[filename].raw_url);
								break;
						}
					}
				} catch (e) {
					console.error(e);
					return channel.send('error:' + e);
				}

			});
		});
	}


	return function init (_bot) {
		bot = _bot;
		redis = bot.redis;

		bot.register({
			pattern: {startsWith: '?'},
			f: doLookup,
			type: 'OUT',
			priority: 1000
		});

		bot.register({
			pattern: {regex: /^\?.+ \-set .+/g},
			f: setLookup,
			type: 'OUT',
			priority: 999,
			flags: {stop: true}
		});

		bot.register({
			pattern: {regex: /^!lookup \-import .+/g},
			f: importLookups,
			type: 'OUT',
			priority: 1000,
			flags: {stop: true}
		});

		bot.register({
			pattern: {regex: /^!lookup \-export .+/g},
			f: exportLookups,
			type: 'OUT',
			priority: 1000,
			flags: {stop: true}
		});

		//todo:
		//!lookup -stats
		//!lookup -resetStats
		//!lookup foo //get the stats for foo

	};


})();