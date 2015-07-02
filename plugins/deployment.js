const _ = require('lodash');
const sys = require('sys');
const exec = require('child_process').exec;

module.exports = (function(){

  let bot;
  let child;

  function killSelf (message, channel, user) {

    let [command, botname=''] = message.parts;

    let slackUser = bot.getUserForMention(botname);
    if (_.isUndefined(slackUser)) {
      slackUser = bot.getUserByName(botname);
    }

    if (_.isUndefined(slackUser) || slackUser.name !== bot.botName) {
      return channel.send('are you talking to me? use `' + command + ' @' + bot.botName + '`');
    }

    bot.ops.isOp(user.name, (err, data) => {
      if (err) return channel.send('error! ' + err);
      if (data === 0) return channel.send('http://i.imgur.com/4C7iu09.gif');
      channel.send('restarting...');
      setTimeout(() => process.exit(1), 2000);
    });

  }

  function doDeploy (message, channel, user) {

    let [command, botname=''] = message.parts;

    let slackUser = bot.getUserForMention(botname);
    if (_.isUndefined(slackUser)) {
      slackUser = bot.getUserByName(botname);
    }

    if (_.isUndefined(slackUser) || slackUser.name !== bot.botName) {
      return channel.send('are you talking to me? use `' + command + ' @' + bot.botName + '`');
    }

    bot.ops.isOp(user.name, (err, data) => {
      if (err) return channel.send('error! ' + err);
      if (data === 0) return channel.send('http://i.imgur.com/4C7iu09.gif');
      channel.send('deploying...');

      child = exec('./extra/deploy.sh', (error, stdout, stderr) => {
        channel.send('out: ```' + stdout + ' ```');
        channel.send('err ```' + stderr + ' ```');
        if (err) return channel.send('error! ' + err);
      });

    });
  }

  return function init(_bot) {
    bot = _bot;

    bot.register({
      pattern: {command: '!restart'},
      f: killSelf,
      type: 'OUT'
    });

    bot.register({
      pattern: {command: '!deploy'},
      f: doDeploy,
      type: 'OUT'
    });
  };



})();