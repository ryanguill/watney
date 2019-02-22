'use strict';

module.exports = (function() {
	const _ = require('lodash');
	const moment = require('moment');
	const request = require('request');

  let bot;
  let config;
  let redis;
  let maxHistoryPerChannel;
  let ignoredChannels = [];

  function createGist(channel, data, callback) {

    data = _.map(data, function(line) {
      try {
        line = JSON.parse(line);
				line.text = line.text.split(' ').map(part => {
					if (part.indexOf('<@U') !== -1) {
              let user = bot.getUserForMention(part);
						user = user || {name: ''};
						return '@' + user.name;
            }
            return part;
				}).join(' ');

				return moment(line.time).format('YYYY-MM-DDTHH:mm:ss[Z]') + ' @' + line.user + ' ' + line.text;
      } catch (e) {
        console.error(e);
      }
    });

		const filename = channel + '-log.txt';

    const formData = {
			description: 'Slack Log from ' + channel,
      public: false,
      files: {}
    };

		formData.files[filename] = {content: data.reverse().join('\n')};

		console.log(JSON.stringify(formData));

		request({
			method: 'POST',
			url: 'https://api.github.com/gists',
			headers: {
			  "user-agent": "https://github.com/ryanguill/watney",
        Authorization: `token ${bot.conf.get("gist_oauth_token")}`,
        "content-type": "application/json"
      },
			form: JSON.stringify(formData)}, callback);
  }

  function isNumber(x) {
    return !isNaN(_.parseInt(x));
  }

  function logMessage(message, channel, user) {
    message.parts = message.parts || [];

    if (_.contains(ignoredChannels, channel.name)) {
      return;
    }

		let text = message.parts.map(part => {
			if (part.indexOf('<@U') !== -1) {
          let user = bot.getUserForMention(part);
				user = user || {name: ''};
				return '@' + user.name;
        }
        return part;
		}).join(' ');

    user = user || {};
    const data = {
      userID: user.id,
      user: user.name,
      text: text,
      time: _.now()
    };
		redis.lpush('channel_log.' + channel.name.toLowerCase(), JSON.stringify(data));
		redis.ltrim('channel_log.' + channel.name.toLowerCase(), 0, maxHistoryPerChannel);
  }

  function getTailForChannel(channelName, lines, callback) {

    if (_.contains(ignoredChannels, channelName)) {
      return;
    }

    lines = lines - 1;
    if (lines < 0) lines = 0;
		redis.lrange('channel_log.' + channelName.toLowerCase(), 0, lines, callback);
  }

  function getHistoryCountForChannel(channelName, callback) {
		redis.llen('channel_log.' + channelName.toLowerCase(), callback);
  }

  function tailCommand(message, channel, user) {
    if (message.parts.length === 2 && isNumber(message.parts[1])) {
      const len = _.parseInt(message.parts[1]);
      getTailForChannel(channel.name, len, function(err, data) {
        if (err) {
          console.error(err);
					return channel.send('error! ' + err);
        }

        if (data.length) {
          createGist(channel.name, data, function(err, response, body) {
            if (err) {
              console.error(err);
							return channel.send('error! ' + err);
            }
            const data = JSON.parse(body);
            channel.send(data.html_url);
          });
        } else {
					channel.send('Sorry, I don`t have any data for channel: ' + channel.name);
        }
      });
    }
  }

  function tailNoArgs(message, channel, user) {
    const len = 50;
    getTailForChannel(channel.name, len, function(err, data) {
      if (err) {
        console.error(err);
				return channel.send('error! ' + err);
      }

      if (data.length) {
        createGist(channel.name, data, function(err, response, body) {
          if (err) {
            console.error(err);
						return channel.send('error! ' + err);
          }
          const data = JSON.parse(body);
          channel.send(data.html_url);
        });
      } else {
				channel.send('Sorry, I don`t have any data for channel: ' + channel.name);
      }
    });
  }

  function tailChannelCommand(message, channel, user) {

    let [command, len, targetChannel, ...rest] = message.parts;
    len = _.parseInt(len);

		targetChannel = targetChannel.replace('<#','').replace('>','');
    const channelLookup = bot.getChannelGroupOrDMByID(targetChannel);
    if (!_.isUndefined(channelLookup)) {
      targetChannel = channelLookup.name;
    }

    getTailForChannel(targetChannel, len, function(err, data) {
      if (err) {
        console.error(err);
				return channel.send('error! ' + err);
      }

      if (data.length) {
        createGist(targetChannel, data, function(err, response, body) {
          if (err) {
            console.error(err);
						return channel.send('error! ' + err);
          }
          const data = JSON.parse(body);
          channel.send(data.html_url);
        });
      } else {
				channel.send('Sorry, I don`t have any data for channel: #' + targetChannel);
      }
    });

  }

  function tailLenChannel(message, channel) {

    let [command, subCommand, targetChannel, ...rest] = message.parts;
    //bot.log(command, subCommand, targetChannel, rest);
		targetChannel = targetChannel.replace('<#','').replace('>','');
    const channelLookup = bot.getChannelGroupOrDMByID(targetChannel);
    if (!_.isUndefined(channelLookup)) {
      targetChannel = channelLookup.name;
    }

    getHistoryCountForChannel(targetChannel, function(err, data) {
      if (data > 0) {
				return channel.send('I have ' + data + ' lines of history for #' + targetChannel);
      } else {
				return channel.send('I don`t have any data for #' + targetChannel);
      }
    });
  }

  function tailLen(message, channel) {

    getHistoryCountForChannel(channel.name, function(err, data) {
      if (data > 0) {
				return channel.send('I have ' + data + ' lines of history for #' + channel.name);
      } else {
				return channel.send('I don`t have any data for #' + channel.name);
      }
    });
  }

  function tailMax(message, channel) {
		return channel.send('I am configured to store ' + maxHistoryPerChannel + ' messages per channel.');
  }

  return function init(_bot, _config) {
    bot = _bot;
    config = _config;
    redis = bot.redis;

    maxHistoryPerChannel = config.maxHistoryPerChannel || 1000;
    ignoredChannels = config.ignoredChannels || [];

    console.log(config, maxHistoryPerChannel, ignoredChannels);

    bot.logMessage = logMessage;

		bot.register({pattern: {},
      f: logMessage,
			type: 'IN'});

		bot.register({pattern: {regex: new RegExp('!tail -len$')},
      f: tailLen,
			type: 'OUT',
      flags: { stop: true }
    });

		bot.register({pattern: {regex: new RegExp('!tail -len .*')},
      f: tailLenChannel,
			type: 'OUT',
      flags: { stop: true }
    });

		bot.register({pattern: {regex: new RegExp('!tail -max$')},
      f: tailMax,
			type: 'OUT',
      flags: { stop: true }
    });

		bot.register({pattern: {regex: new RegExp('!tail [0-9]+$')},
      f: tailCommand,
			type: 'OUT',
      flags: { stop: true }
    });

		bot.register({pattern: {regex: new RegExp('!tail [0-9]+ .*$')},
      f: tailChannelCommand,
			type: 'OUT',
      flags: { stop: true }
    });

		bot.register({pattern: {regex: new RegExp('!tail$')},
      f: tailNoArgs,
			type: 'OUT',
      flags: { stop: true }
    });
  };
})();
