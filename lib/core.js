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
    bot.redis = initRedis();
    bot.setCooldown = setCooldown;
    bot.isOnCooldown = isOnCooldown;
    bot.clearAllCooldowns = clearAllCooldowns;
    bot.isChannelPaused = isChannelPaused;

    var registeredPatterns = [];

    //todo: add shortcut alias, bot.addResponder(), bot.addReader()
    bot.register = function register (params) {
      params = _.merge({
        priority: 1000,
        flags: {}
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
      //empty pattern matches everything
      if (_.isEmpty(pattern)) return true;

      if (_.has(pattern, 'startsWith')) {
        if (!_.startsWith(message.text.toLowerCase(), pattern.startsWith.toLowerCase())) return false;
      }

      if (_.has(pattern, 'command')) {
        let command = _.first(message.parts);
        if (!_.isUndefined(command)) {
          command = command.toLowerCase();

          if (command !== pattern.command.toLowerCase()) return false;
        }
      }

      if (_.has(pattern, 'regex')) {
        if (!pattern.regex.test(message.text)) return false;
      }

      return true;
    };

    var getMatchingPatterns = function getMatchingPatterns (message, channel, user) {
      return _.filter(registeredPatterns, function(p) {
        return matchPattern(p.pattern, message, channel, user);
      });
    };

    bot.wrapChannel = function wrapChannel (channel) {
      var originalChannelSend = channel.send;
      channel.send = function(text, dontLog) {
        dontLog = dontLog || false;
        if (!dontLog) {
          bot.countMessage(channel.name, bot.botName, text);
          bot.lgoMessage(channel.name, bot.botName, text);
        }
        originalChannelSend.call(bot, text);
      };
    };

    function isChannelPaused(channel) {
      return _.some(pausedRooms, function (item) {
        return item === channel;
      });
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

    bot.on('message', function(message) {
      message = trimMessage(message);
      var channel = bot.getChannelGroupOrDMByID(message.channel);
      var user = bot.getUserByID(message.user);

      //check to make sure we arent ignoring this channel...
      if (_.contains(bot.ignoreChannels, channel.name)) {
        return;
      }

      var patterns = getMatchingPatterns(message, channel, user);

      bot.log('onMessage/patternCount', message.text, patterns.length, patterns);

      if (patterns.length) {
        var outPatterns = patterns.filter(p => p.type === 'OUT');
        var inPatterns = patterns.filter(p => p.type === 'IN');

        _.forEach(outPatterns, function (p) {
          //bot.log(p);
          p.f.call(undefined, message, channel, user);
          if (!_.isUndefined(p.flags.stop) && p.flags.stop) {
            return false;
          }
        });

        _.forEach(inPatterns, function (p) {
          //bot.log(p);
          p.f.call(undefined, message, channel, user);
          if (!_.isUndefined(p.flags.stop) && p.flags.stop) {
            return false;
          }
        });
      }
    });
  };
})();
