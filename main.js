'use strict';

(function bootstrap(){

    require('babel/register')({
      // Setting this will remove the currently hooked extensions of .es6, `.es`, `.jsx`
      // and .js so you'll have to add them back if you want them to be used again.
      extensions: ['.es6', '.es', '.jsx', '.js']
    });


  var _ = require('lodash');
	var conf = require('nconf')
		.argv()
		.env()
		.file({file: getConfigFile()})
		.defaults({
			'karmaCooldown': 60
			,'testingChannel': '#bots'
		});

	var bot = initSlack( conf );
  bot.login();

	bot.setMaxListeners(20);
	bot.use( require('./lib/core') );
	//bot.use( require('./lib/ops') );
	bot.loadPlugins();

	//=====================================================

	function getConfigFile(){
		var override = './lib/config.user.json'
			,def = './lib/config.json';
		return require('fs').existsSync(override) ? override : def;
	}

	function initSlack( conf ){
		var Slack = require( 'slack-client' );
		var b = new Slack(
			conf.get('slackToken')
			, conf.get('autoReconnect')
			, conf.get('autoMark')
		);

		b.conf = conf;
    b.botName = conf.get('botName');

    if (_.isUndefined(b.botName)) {
      throw('you must define the botName in the config file!');
    }

		b.testingChannel = conf.get('testingChannel');
		b.ignoreChannels = conf.get('ignoreChannels');


		b.on('open', function() {
      b.channelList = Object.keys(b.channels)
        .map(function (k) { return b.channels[k]; })
        .filter(function (c) { return c.is_member; })
        .map(function (c) { return c.name; });

      b.groupList = Object.keys(b.groups)
        .map(function (k) { return b.groups[k]; })
        .filter(function (g) { return g.is_open && !g.is_archived; })
        .map(function (g) { return g.name; });

      b.botName = b.self.name;

      console.log('Welcome to Slack. You are ' + b.self.name + ' of ' + b.team.name);

      if (b.channelList.length > 0) {
          console.log('You are in: ' + b.channelList.join(', '));
      }
      else {
          console.log('You are not in any channels.');
      }

      if (b.groupList.length > 0) {
         console.log('As well as: ' + b.groupList.join(', '));
      }

		});


    b.use = function use (plugin){
      plugin(bot);
    };

    b.loadPlugins = function loadPlugins() {
      var plugins = [];
      var walk = require('walk');
      var walker = walk.walk('./plugins', { followLinks: false });

      walker.on('file', function(root, stat, next){

        if (_.contains(['.js', '.es6'], stat.name.slice(-3))){
          console.log('loading plugin %s/%s', root, stat.name);
          try {
            bot.use(require(root + '/' + stat.name));
            plugins.push(root + '/' + stat.name);
          }catch (err){
            console.error(err);
            console.log('----------------------');
          }
        }

        next();
      });

      walker.on('end', function(){
        console.log('plugins loaded: %s', plugins);
      });
    };

    return b;
	}
})();
