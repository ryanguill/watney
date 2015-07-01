'use strict';

const _ = require('lodash');
const isup = require('is-up');
const validator = require('valid-url');

module.exports = (function(){

	let _bot;

  function checkurl (message, channel, user) {
    let url = _.last(message.text.replace('^<', '').replace('>', '').split('|'));

    if (_.isUndefined(url) || !validator.isWebUri( 'http://' + url )){
      //fail silently since this doesn't appear to be a url
      return;
    }

    isup(url, function(err, up){
      channel.send(url + ' is ' + (up ? 'up' : 'down') + ' for me' + (up ? '...' : ' too.') );
    });
  }

	return function init(bot) {
		_bot = bot;

    bot.register({
      pattern: {regex: /\^[^\s]{4,}$/g},
      f: checkurl,
      type: 'OUT'
    });
	};

})();
