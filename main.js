'use strict';

(function bootstrap() {

	var babel = require('babel-core');
	require('babel/polyfill');

	var _ = require('lodash');
	var fs = require('fs');

	var conf = require('nconf')
		.argv()
		.env()
		.file({file: getConfigFile()})
		.defaults({
			testingChannel: '#bots'
		});

	var bot = initSlack(conf);

	bot.login();
	bot.loadPlugins();

	//=====================================================

	function getConfigFile() {
		var override = './lib/config.user.json'
			, def = './lib/config.json';
		return require('fs').existsSync(override) ? override : def;
	}

	function getWatneyConfigFile() {
		var override = './lib/watney.user.json'
			, def = './lib/watney.json';
		return require('fs').existsSync(override) ? override : def;
	}

	function ensureExists(path, cb) {
		fs.mkdir(path, function(err) {
			if (err) {
				if (err.code === 'EEXIST') {
					cb(null);
				} else {
					cb(err);
				}
			} else {
				cb(null);
			}
		});
	}

	function copyFile(source, target, cb) {
		var cbCalled = false;

		var rd = fs.createReadStream(source);
		rd.on('error', function(err) {
			done(err);
		});
		var wr = fs.createWriteStream(target);
		wr.on('error', function(err) {
			done(err);
		});
		wr.on('close', function(ex) {
			done();
		});
		rd.pipe(wr);

		function done(err) {
			if (!cbCalled) {
				cb(err);
				cbCalled = true;
			}
		}
	}

	function initSlack(conf) {
		var Slack = require('slack-client');
		var b = new Slack(
			conf.get('slackToken')
			, conf.get('autoReconnect')
			, conf.get('autoMark')
		);

		b.conf = conf;
		b.botName = conf.get('botName').toLowerCase();

		if (_.isUndefined(b.botName)) {
			throw('you must define the botName in the config file! ' + getConfigFile());
		}

		b.testingChannel = conf.get('testingChannel');
		b.ignoreChannels = conf.get('ignoreChannels');


		b.on('open', function () {
			b.channelList = Object.keys(b.channels)
				.map(function (k) {
					return b.channels[k];
				})
				.filter(function (c) {
					return c.is_member;
				})
				.map(function (c) {
					return c.name;
				});

			b.groupList = Object.keys(b.groups)
				.map(function (k) {
					return b.groups[k];
				})
				.filter(function (g) {
					return g.is_open && !g.is_archived;
				})
				.map(function (g) {
					return g.name;
				});

			b.botName = b.self.name;
			b.id = b.self.id;

			console.log('Welcome to Slack. You are ' + b.self.name + ' of ' + b.team.name);

			if (b.channelList.length > 0) {
				console.log('You are in: ' + b.channelList.join(', '));
			} else {
				console.log('You are not in any channels.');
			}

			if (b.groupList.length > 0) {
				console.log('As well as: ' + b.groupList.join(', '));
			}

		});


		b.use = function use(plugin, config) {
			plugin(bot, config);
		};

		b.loadPlugins = function loadPlugins() {
			var loadedPlugins = [];

			//load config file
			var watneyConf = require(getWatneyConfigFile());

			function loadPluginsInOrder(plugins, finalCallback) {
				var plugin = _.first(plugins);

				if (_.isUndefined(plugin)) {
					if (_.isFunction(finalCallback)) {
						finalCallback(loadedPlugins);
					}
					return;
				}

				if (_.isUndefined(plugin.preprocess)) {
					plugin.preprocess = 'babel';
				}

				if (_.isUndefined(plugin.disabled) || !_.isBoolean(plugin.disabled)) {
					plugin.disabled = false;
				}

				if (_.isUndefined(plugin.id) || !plugin.id.length) {
					console.error('Invalid Plugin in watney configuration, please provide an id.', plugin);
					throw 'Invalid Plugin Configuration';
				}

				if (_.isUndefined(plugin.path) || !plugin.path.length) {
					console.error('Invalid Plugin in watney configuration, please provide a path to the plugin.', plugin);
					throw 'Invalid Plugin Configuration';
				}

				if (_.find(loadedPlugins, {id: plugin.id})) {
					throw 'Plugins can only be loaded once: ' + plugin.id;
				}

				if (plugin.disabled) {
					return loadPluginsInOrder(_.rest(plugins), finalCallback);
				}


				plugin.binDir = './bin/' + plugin.id;
				plugin.binPath = plugin.binDir + '/' + plugin.id + '.js';
				plugin.binMapPath = plugin.binDir + '/' + plugin.id + '.map';

				loadedPlugins.push(plugin);



				ensureExists(plugin.binDir, function (err) {
					if (err) throw(err);

					if (plugin.preprocess === 'babel') {
						babel.transformFile(plugin.path, {}, function (err, result) {
							if (err) throw(err);

							fs.writeFile(plugin.binPath, result.code, {}, function (err) {
								if (err) throw(err);

								console.log('Loaded', {id: plugin.id, preprocess: plugin.preprocess});
								bot.use(require(plugin.binPath), plugin);
								loadPluginsInOrder(_.rest(plugins), finalCallback);
							});
							fs.writeFile(plugin.binMapPath, result.map, {}, function (err) {
								if (err) throw(err);
							});

						});

					} else {
						copyFile(plugin.path, plugin.binPath, function (err, result) {
							if (err) throw(err);

							console.log('Loaded', {id: plugin.id, preprocess: plugin.preprocess});
							bot.use(require(plugin.binPath), plugin);
							loadPluginsInOrder(_.rest(plugins), finalCallback);
						});
					}
				});
			}

			ensureExists('./bin', function(err) {
				if (err) throw(err);

				loadPluginsInOrder(watneyConf.plugins, function(plugins) {
					console.log('Plugin Load Complete, plugin count: ', plugins.length);
				});
			});
		};

		return b;
	}
})();
