'use strict';

module.exports = (function(){
    let _ = require('lodash');
    let moment = require('moment');
    let bot;
    let redis;
    let maxHistoryPerChannel;
    let request = require('request');


/*

        bot.on('message', function(from, to, text, message) {
            logMessage(to, message.nick, message.user, text);

            if (bot.isChannelPaused(to)) return;

			if (to === bot.botName) {
			    //they are talking to us in a private message, set to to be from
			    to = from;
			}

            var parts = text.split(' ');
            var channel = to;

            if (parts[0] === '#tail') {
                if (parts.length > 1) {
                    if (parts[1] === '!len') {
                        if (parts.length > 2) {
                            channel = parts[2];
                        }
                        getHistoryCountForChannel(channel, function(err, data) {
                            if (err) {
                                console.error(err);
                                return bot.say(to, err);
                            }
                            return bot.say(to, 'I have ' + data + ' lines of history for ' + channel);
                        });
                    } else if (parts[1] === '!max') {
                        return bot.say(to, maxHistoryPerChannel);
                    } else if (parts[1] === '!missed') {
                        if (parts.length > 2) {
                            channel = parts[2];
                        }
                        //get the last time I left
                        var output = [];
                        redis.hget(bot.botName + '.' + channel + '.lastleave', from.toLowerCase(), function(err, lastSeenTime) {
                            if (lastSeenTime !== null) {
                                var lastSeenDateString = new Date(_.parseInt(lastSeenTime));

                                redis.lrange('channel_log.' + channel, 0, maxHistoryPerChannel, function(err, data){
                                    if (err) {
                                        console.error(err);
                                        return bot.say(to, err);
                                    }

                                    _.each(data, function(line) {
                                        var lineData = JSON.parse(line);
                                        output.push(line);
                                        if (lineData.time < lastSeenTime) {
                                            return false;
                                        }
                                    });

                                    if (output.length) {
                                        createGist(channel, output, function (err, response, body) {
                                            if (err) {
                                                console.error(err);
                                                return bot.say(to, err);
                                            }
                                            try {
                                                var data = JSON.parse(body);
                                                bot.say(to, from + ': Log of messages in ' + channel + ' since ' + lastSeenDateString.toLocaleString() + ': ' + data.html_url);
                                            } catch (e) {
                                                console.error(e);
                                            }

                                        });
                                    } else {
                                        bot.say(to, 'Sorry, there haven`t been any messages in ' + channel + ' since ' + lastSeenDateString.toLocaleString());
                                    }

                                });

                            } else {
                                bot.say(to, 'who are you again? (I don`t know when you last left, so I can`t give you what you have missed)');
                            }
                        });
                    } else if (isNumber(parts[1])) {
                        //assume to is channel and parts[1] is the number of lines
                        getTailForChannel(to, _.parseInt(parts[1]), function (err, data) {
                            if (err) {
                                console.error(err);
                                return bot.say(to, err);
                            }

                            if (data.length) {
                                createGist(to, data, function (err, response, body) {
                                    if (err) {
                                        console.error(err);
                                        return bot.say(to, err);
                                    }
                                    var data = JSON.parse(body);
                                    bot.say(to, data.html_url);
                                });
                            } else {
                                return bot.say(to, 'Sorry, I don`t have any data for channel: ' + to);
                            }
                        });
                    } else if (parts.length > 2 && isNumber(parts[2])) {
                        channel = parts[1];
                        getTailForChannel(channel, _.parseInt(parts[2]), function (err, data) {
                            if (err) {
                                console.error(err);
                                return bot.say(to, err);
                            }

                            if (data.length) {
                                createGist(channel, data, function (err, response, body) {
                                    if (err) {
                                        console.error(err);
                                        return bot.say(to, err);
                                    }
                                    var data = JSON.parse(body);
                                    bot.say(to, data.html_url);
                                });
                            } else {
                                return bot.say(to, 'Sorry, I don`t have any data for channel: ' + channel);
                            }
                        });
                    } else {
                        return bot.say(to, 'use #tail <number of lines> or #tail <channel> <number of lines>');
                    }
                } else {
                    return bot.say(to, 'use #tail <number of lines> or #tail <channel> <number of lines>');
                }
            }
        });
    };
*/

    function createGist (channel, data, callback) {

        data = _.map(data, function(line) {
            try {
                line = JSON.parse(line);
                return moment(line.time).format('YYYY-MM-DDTHH:mm:ss[Z]') + ' @' + line.user + ' ' + line.text;
            } catch (e) {
                console.error(e);
            }
        });

        var filename = channel + '-log.txt';

        var formData = {
                description: 'IRC Log from ' + channel,
                public: false,
                files: {}
            };

        formData.files[filename] = {content: data.reverse().join('\n')};

        request({
            method: 'POST',
            url: 'https://api.github.com/gists',
            headers: {'user-agent': 'https://github.com/atuttle/zoidbox'},
            form: JSON.stringify(formData)}, callback);
    }

    function isNumber (x) {
        return !isNaN(_.parseInt(x));
    }

    function logMessage (message, channel, user) {
      user = user || {};
      var data = {
        userID: user.id,
        user: user.name,
        text: message.text,
        time: _.now()
      };
      redis.lpush('channel_log.' + channel.name, JSON.stringify(data));
      redis.ltrim('channel_log.' + channel.name, 0, maxHistoryPerChannel);
    }

    function getTailForChannel (channel, lines, callback) {
        lines = lines - 1;
        if (lines < 0) lines = 0;
        redis.lrange('channel_log.' + channel, 0, lines, callback);
    }

    function getHistoryCountForChannel (channel, callback) {
        redis.llen('channel_log.' + channel, callback);
    }

    function tailCommand (message, channel, user) {
      if (message.parts.length === 2 && isNumber(message.parts[1])) {
        var len = _.parseInt(message.parts[1]);
        getTailForChannel(channel.name, len, function (err, data) {
          if (err) {
              console.error(err);
              return channel.send('error! ' + err);
          }

          if (data.length) {
              createGist(channel.name, data, function (err, response, body) {
                  if (err) {
                    console.error(err);
                    return channel.send('error! ' + err);
                  }
                  var data = JSON.parse(body);
                  channel.send(data.html_url);
              });
          } else {
              channel.send('Sorry, I don`t have any data for channel: ' + channel.name);
          }
        });
      }
    }

    return function init( _bot) {
      bot = _bot;
      redis = bot.redis;
      maxHistoryPerChannel = _.parseInt(bot.conf.get('maxHistoryPerChannel'));

      bot.logMessage = logMessage;

      bot.register({pattern: {},
        f: logMessage,
        type: 'IN'});

      bot.register({pattern: {command: '!tail'},
        f: tailCommand,
        type: 'OUT'});
    };
})();
