'use strict';

module.exports = (function(){

	var bot;
	var redis;
	var moment = require('moment');
	var _ = require('lodash');
	var async = require('async');

	var pausedRooms = [];

	return function init( _bot ) {
		bot = _bot;
		bot.log = log;
		bot.starttime = Date.now();
		bot.redis = redis = initRedis();

		bot.setCooldown = setCooldown;
		bot.isOnCooldown = isOnCooldown;
		bot.clearAllCooldowns = clearAllCooldowns;
		bot.isChannelPaused = isChannelPaused;
		bot.pauseChannel = pauseChannel;
		bot.playChannel = playChannel;

		var registeredPatterns = [];
		var registeredIntervals = [];

		//todo: add shortcut alias, bot.addResponder(), bot.addReader()
		bot.register = function register (params) {
			params = _.merge({
				priority: 1000,
				flags: {},
				eventType: 'message'
			}, params);

			if (_.isUndefined(params.pattern) || !_.isObject(params.pattern)) {
				bot.log('Invalid Pattern Registration', 'invalid pattern: ' + params.pattern);
				return;
			}

			if (_.isUndefined(params.f) || !_.isFunction(params.f)) {
				bot.log('Invalid Pattern Registration', 'invalid function (f)');
				return;
			}

			if (!_.contains(['IN', 'OUT'], params.type)) {
				bot.log('Invalid Pattern Registration', 'invalid type: ' + params.type);
				return;
			}

			registeredPatterns.push(params);

			registeredPatterns = _.sortBy(registeredPatterns, 'priority');

			if (params.eventType === 'interval') {
				params.pattern.delay = params.pattern.delay || 1000 * 60 * 60;

				if (!_.isFinite(params.pattern.delay) || params.pattern.delay < 0) {
					throw 'Invalid Delay: ' + params.pattern.delay;
				}

				registeredIntervals.push(setInterval(function() {
					bot.log('Interval ', params.f.name, params.pattern);
					params.f(params);
				}, params.pattern.delay));
			}
		};

		bot.registerMessage = function (params) {
			params.eventType = 'message';

			bot.register(params);
		};

		bot.registerPresenceChange = function (params) {
			params.eventType = 'presenceChange';

			bot.register(params);
		};

		bot.registerInterval = function (params) {
			params.eventType = 'interval';

			bot.register(params);
		};

		bot.registerMessage = function (params) {
			params.eventType = 'message';

			bot.register(params);
		};

		bot.makeMention = function(user) {
			if (_.isObject(user) && _.has(user, 'id')) {
				user = user.id;
			}
			return '<@' + user + '>';
		};

		bot.getUserForMention = function(input) {
			input = input.replace('<@','').replace('>','');
			return bot.getUserByID(input);
		};

		var isDirect = function(userId, messageText) {
			var userTag = bot.makeMention(userId);
			return messageText &&
				messageText.length >= userTag.length &&
				messageText.substr(0, userTag.length) === userTag;
		};

		//todo: this function name should change
		var trimMessage = function trimMessage (message) {
			message.text = message.text || '';
			message.rawText = message.text;
			message.text = message.text.trim();
			//might need to remove direct notification later
			//message.text.substr(makeMention(slack.self.id).length)

			message.parts = message.text.split(' ');

			//replace channels
			message.text = _.map(message.parts, function(p) {

				if (new RegExp('<#.+>').test(p)) {
					let c = bot.getChannelGroupOrDMByID(p.replace('<#','').replace('>',''));

					if (!_.isUndefined(c)) return '#' + c.name;
				}
				return p;
			}).join(' ');

			message.isDirect = isDirect(message.user, message.text);
			return message;
		};

		var matchPattern = function matchPattern (pattern, message, channel, user) {

			//console.log('start matchPattern-----------');
			//console.log('pattern', pattern, 'message', message.text);

			//empty pattern matches everything
			if (_.isEmpty(pattern)) {
				//console.log('empty pattern');
				return true;
			}

			if (_.has(pattern, 'startsWith')) {
				if (!_.startsWith(message.text.toLowerCase(), pattern.startsWith.toLowerCase())) {
					//console.log('startsWith');
					return false;
				}
			}

			if (_.has(pattern, 'command')) {
				let command = _.first(message.parts);
				if (!_.isUndefined(command)) {
					command = command.toLowerCase();

					if (command !== pattern.command.toLowerCase()) {
						//console.log('command');
						return false;
					}
				} else {
					//console.log('nocommand');
					return false;
				}
			}

			if (_.has(pattern, 'regex')) {
				let test = pattern.regex.test(message.text);
				pattern.regex.lastIndex = 0;
				if (test !== true) {
					return false;
				}
			}

			//console.log('end matchPattern-----------');

			return true;
		};

		var getMatchingPatterns = function getMatchingPatterns (eventType, message, channel, user) {
			let patterns = _.filter(registeredPatterns, {eventType: eventType});
			return _.filter(patterns, function(p) {
				return matchPattern(p.pattern, message, channel, user);
			}).map(p => {
				p.flags.stop = p.flags.stop || false;
				p.flags.ignorePaused = p.flags.ignorePaused || false;
				return p;
			});
		};

		function wrapChannel (channel) {
			if (!_.has(channel, 'originalChannelSend')) {
				channel.originalChannelSend = channel.send;
				channel.send = function (text, dontLog) {
					dontLog = dontLog || false;

					if (!dontLog) {
						bot.countMessage({text: text}, channel, bot.getUserByName(bot.botName));
						bot.logMessage({text: text}, channel, bot.getUserByName(bot.botName));
					}
					channel.originalChannelSend.call(channel, text);
				};
			}
			return channel;
		}

		function pauseChannel (channel, user) {
			bot.ops.isOp(user.name, (err, data) => {
				if (err) return channel.send('error! ' + err);
				if (data === 0) return channel.send('You must be an OP to do that.');
				pausedRooms = _.union(pausedRooms, [channel.name]);
				return channel.send('I have been blocked from responding to all input in ' + channel.name +
					'. An OP must issue !play for me to resume.');
			});
		}

		function playChannel (channel, user) {
			bot.ops.isOp(user.name, (err, data) => {
				if (err) return channel.send('error! ' + err);
				if (data === 0) return channel.send('You must be an OP to do that.');
				pausedRooms = _.difference(pausedRooms, [channel.name]);
				return channel.send('I`m back!');
			});
		}

		function isChannelPaused (channel) {
			return _.some(pausedRooms, (item) => item === channel.name);
		}

		function setCooldown(key, timeoutInSeconds) {
			if (!_.isArray(key)) {
				key = [key];
			}

			_.each(key, function (item) {
				redis.hset(bot.botName + '.cooldown', item, Date.now() + (timeoutInSeconds * 1000));
			});
		}

		function isOnCooldown(key, callback) {
			if (!_.isArray(key)) {
				key = [key];
			}

			async.some(key, isOnCooldownHelper, function (result) {
				callback(null, result);
			});
		}

		function isOnCooldownHelper(key, callback) {
			redis.hget(bot.botName + '.cooldown', key, function (err, data) {
				if (err) {
					log('isOnCooldown Error', err, data);
					callback(false);
				}

				log('isOnCooldownHelper:', key, data);
				if (_.isNull(data)) {
					callback(false);
				} else {
					if (Date.now() < data) {
						callback(true);
					} else {
						callback(false);
					}
				}
			});
		}

		function clearAllCooldowns() {
			redis.del(bot.botName + '.cooldown', function (err, data) {
				if (err) {
					log('clearAllCooldowns error:', err, data);
				}
			});
		}

		function initRedis() {
			var redis;

			if (bot.conf.get('REDISTOGO_URL')) {
				var rtg = require('url').parse(bot.conf.get('REDISTOGO_URL'));
				redis = require('redis').createClient(rtg.port, rtg.hostname);
				redis.auth(rtg.auth.split(':')[1]);
			} else {
				redis = require('redis').createClient(
					bot.conf.get('redis_port')
					, bot.conf.get('redis_host')
					, {}
				);
				if (bot.conf.get('redis_auth_pass')) {
					redis.auth(bot.conf.get('redis_auth_pass'), function (err, data) {
						if (err) {
							bot.log('redisClientAuthError:', err, data);
						}
					});
				}
				bot.log('redis initialized');
			}

			redis.on('error', function (err) {
				bot.log('redisClientError:', err);
			});

			return redis;
		}

		function log() {
			if (bot.conf.get('debug') || false) {
				console.log(Array.prototype.slice.call(arguments));
			}
		}

		bot.on('error', function (err) {
			log('irc error', err);
		});

		bot.on('presenceChange', function(user, presence) {

			var patterns = getMatchingPatterns('presenceChange', presence, null, user);

			bot.log('presenceChange/patternCount', user.name, presence, patterns.length);

			if (patterns.length) {
				var outPatterns = patterns.filter(p => p.type === 'OUT');
				var inPatterns = patterns.filter(p => p.type === 'IN');

				_.forEach(outPatterns, function (p) {
					//bot.log(p);
					p.f.call(undefined, user, presence);
					if (!_.isUndefined(p.flags.stop) && p.flags.stop) {
						return false;
					}
				});

				_.forEach(inPatterns, function (p) {
					//bot.log(p);
					p.f.call(undefined, user, presence);
					if (!_.isUndefined(p.flags.stop) && p.flags.stop) {
						return false;
					}
				});
			}

		});

		bot.on('message', function(message) {
			message = trimMessage(message);
			var channel = wrapChannel(bot.getChannelGroupOrDMByID(message.channel));
			var user = bot.getUserByID(message.user) || bot.getUserByName(message.username) || {name: message.username};

			if (_.isUndefined(message.type)) return;
			if (message.text.length === 0) return;

			//console.log({text: message.text, type: message.type, user: user.name, messageUser: message.user, channel: channel.name, keys: _.keys(message)});

			//check to make sure we arent ignoring this channel...
			if (_.contains(bot.ignoreChannels, channel.name)) {
				return;
			}

			let channelPaused = isChannelPaused(channel);

			var patterns = getMatchingPatterns('message', message, channel, user);

			bot.log('onMessage/patternCount', message.text, patterns.length);

			if (patterns.length) {
				var outPatterns = patterns.filter(p => p.type === 'OUT');
				var inPatterns = patterns.filter(p => p.type === 'IN');

				_.forEach(outPatterns, function (p) {
					//bot.log(p);
					if (!channelPaused || p.flags.ignorePaused) {
						p.f.call(undefined, message, channel, user);
						if (!_.isUndefined(p.flags.stop) && p.flags.stop) {
							return false;
						}
					}
				});

				_.forEach(inPatterns, function (p) {
					//bot.log(p);
					if (!channelPaused || p.flags.ignorePaused) {
						p.f.call(undefined, message, channel, user);
						if (!_.isUndefined(p.flags.stop) && p.flags.stop) {
							return false;
						}
					}
				});
			}
		});
	};
})();
