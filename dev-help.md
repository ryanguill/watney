# Development Help

So you want to contribute to watney? Or maybe fork it and use in your own slack room with your own integrations? Here are a few topics that will help.

Definitely read these things if you plan on contributing back to Watney itself.

# Setup

Getting started should be as simple as:

- Fork the repo on github
- Clone your fork locally
- use `npm install` to install the dependencies
- copy `lib/config.json` to `lib/config.user.json`
- Note: if you want to develop in the cfml slack room, contact an admin for an api key and you can skip these next steps.  It is easy to set up your own personal slack room though if you think you will be testing frequently.
  - go to the slack room that you want to integrate with, 'Configure Integrations'
  - search for 'bots' and add that integration
  - come up with a username for your bot and get an api key
- update `lib.config.user.json` with appropriate values, your api key and your bot's username especially. You probably want to ignore the #cfml-general room - you can not remove your bot from that room and probably don't want to spam it while you develop. Add ignores **without** the octothorpe. Do this: `"ignoreChannels": ["cfml-general"]` not this: `"ignoreChannels": ["#cfml-general"]`
- run `node main.js` to connect and test!

That may have seemed complicated, but really shouldn't take more than a few minutes.

# Updating

Whether you intend to contribute back to watney or not, you probably want to stay up to date with its progress.  Doing so with git is relatively simple, but does require a few extra steps. You want to create a remote called "upstream" that you will be able to pull changes from.  You absolutely need to do this if you intend to contribute to watney.  A quick guide:

From your git command line, do the following

`git remote add upstream https://github.com/ryanguill/watney.git`

Then anytime you want to make sure you are up to date, do:

`git pull --rebase upstream master`

This will get you up to date, then you can branch from here.  If you want to submit a pull request with your changes, commit your changes to your origin, which is your github fork.  Then you can use the github interface to create the pull request (also called a PR).  You will always want to target the master branch in the watney repo.

Also, anytime you do pull from upstream, it is a good idea you have updated your npm dependencies, in case anything has changed.

`npm install`

## Style and Quality

Try and match style of the plugin you are in - if you are the one writing the plugin, feel free to use your own style - within the style guidelines set up.

We use JSCS and JSHint.  Please make sure you run your code through these tools before submitting a PR. Appropriate "rc" files for both are in the root of the repository.

### IntelliJ

If you are using intellij, JSCS and JSHint support is built in.  For JSCS you still have to download the JSCS npm module first and point to it.  Use the supplied rc files though for your configuration.

You also want to change your Javascript Language Version to ECMAScript 6.

### Sublime Text 3

Packages for JSHint and JSCS are available through [package control](https://packagecontrol.io/) ([install instructions](https://packagecontrol.io/installation#st3)). There are several JSHint plugins available, but most of us use [JSHint Gutter](https://packagecontrol.io/packages/JSHint%20Gutter). Use [JSCS Formatter](https://packagecontrol.io/packages/JSCS-Formatter) to auto-format your code according to `.jscsrc` rules with a single keystroke.

# Notes

`main.js` is written using ES5 level node.js code.  This bootstraps the whole process, and for most development you shouldn't need to modify it.

The project uses [babel](https://babeljs.io/) to allow us to _optionally_ write ES6 (ES2015)+ level code in all of the plugins by default, although you can now override this.  

All local modules (not npm dependencies) loaded will be transpiled automatically unless explicitly overridden so you can use ES5 plus to develop them.  If you are more comfortable sticking with ES5, go for it, just specify "preprocess": "none" in your watney.user.json file.
If you are trying to update an existing module written in ES6, please try to match its style.

The only sticking point about transpiling from ES6 is that debugging can be difficult with many editors (although that should be improving).  You can use `console.log` of course, and there is also `bot.log()` available in plugins that works the same way but only actually logs anything when configured with `debug: true` in your `config.user.json` file.

# Plugin API

There are really only a few things to know about how to write a new plugin.  

### watney.user.json

The first is the `watney.json` / `watney.user.json` file.  Like `config.user.json`, `watney.user.json` will be used if it exists, just copy `watney.json` and make your changes in your user file.  
Only make changes to `watney.json` that you intend to commit back upstream. Never commit your `watney.user.json` file. 

This file defines all of the plugins that watney will load and their order.  It also defines any configuration specific to that plugin and will be passed in when the plugin is created.

At a minimum, all plugins need to have the following keys in their definition:

```json
{
  "id": "{plugin-id}",
  "path": "plugins/{plugin-id}.js"
}
```

Make sure you use a unique ID and make sure you specify the right path to the plugin.  Any plugins that are part of watney itself should be in the `plugins/` directory; If you are creating a plugin that is private that you do not intend to contribute back, create a separate directory like `user-plugins/` or something like it to store your plugin in.  At the end of the day watney doesn't care though as long as the path is correct.  It is just a convention.

By default there is another key that is assumed called "preprocess" with a value of "babel".  This will cause your plugin to be transpiled by babel.js.  If you do not want to use babel, and only want to use stock es5 nodejs, you can specify `"preprocess":"none"` in the config and no preprocessing will occur.  Look at the echo plugin for an example of this.  There may be support for other preprocessors in the future such as coffeescript, typescript or clojurescript.  If that is something you are interested in, please get in touch. 

By default there is also a key called "disabled" that is defaulted to false of course.  If you want to remove a plugin from being loaded you have two options, either remove the plugin configuration alltogether, or set "disabled":true and it will not be loaded.  This is the preferred method of disabling built in plugins. Look at the echo plugin for an example of this.  

All configuration keys will be passed in to your plugin's init method as the second argument.  You can provide any other configuration keys you want to be passed in.  This is a great place to put any external authentication keys or configurable parameters.  Look at the ops or history plugins for examples of this.

Just remember that the plugins are in the order that they will be loaded, if you have a dependency on another plugin, make sure you are load the plugin after the one you are dependent on.

### registering for events

The second is how to register your interest in different events.

All plugins should use this basic template:

```javascript
//requires here
const _ = require('lodash'); //for example

module.exports = (function(){

	let bot,
		config;

	//your functions here

	function doSomethingCool (message, channel, user) {
		//
	}

	return function init (_bot, _config) {
		bot = _bot;
		config = _config; //this is your configuration object from your watney.user.json file.

		//any startup steps here

		//one of these for each pattern you want to register
		bot.register({
			pattern: {},
			f: doSomethingCool,
			type: 'OUT',
			eventType: 'message',
			priority: 1000,
			flags: {}
		});

		//more pattern registrations
	});
})();
```

The `_bot` parameter passed to the `init` method contains many helpful resources and functions that will be documented more as time goes on.  One of the big ones is `bot.redis` which can be used to persist data.  Look at the ops plugin for a relatively simple example of how to use redis, although a lot of plugins use it so look around if you need more examples.

## Pattern registration

There are currently two different event types (although this will almost certainly grow soon): `message` (the default) and `presenceChange`.

There are currently two different types of registrations, `IN` and `OUT`.  `IN` is for when you just want to take in input, but don't expect to send any response. Logging would be a good example of a valid use of `IN`. `OUT` signifies that you want to send a response.

You can use multiple pattern registrations pointing to the same function if you want to allow multiple inputs to use the same processing.

To register your plugins interest in a pattern, call `bot.register` and pass an object with the following keys. If you want to pass the default value for a key, you can omit that key entirely.

```javascript
{
	//required, see more information below
	pattern: {},

	//required, a reference to the function that you want called
	//when a message comes through that matches this pattern
	f: functionName,

	//required, either 'OUT' or 'IN' - you must use 'OUT'
	//if you intend to send responses
	type: 'OUT',

	//defaults to 'message', currently can be either 'message' or
	//'presenceChange' - this value determines what is sent to the function
	eventType: 'message',

	//defaults to 1000 - can be used to make sure that certain
	//registrations are executed before or after other patterns,
	//even in other plugins, relative to the type.  'IN' patterns
	//always execute before 'OUT' patterns.
	priority: 1000,

	//an object - defaults to an empty object.  Setting keys inside of
	//this object to true can alter execution - see more information below
	flags: {}
}
```

### Pattern Options

Currently, pattern objects can use the following keys, which can be combined.  Pattern matching works on exclusion, patterns are considered matched until they encounter a rule that fails.

An empty pattern object `{}` matches everything.

You can use the `startsWith` pattern to match any message that starts with the string, for example: `{startsWith: '%'}` would match any trimmed string that starts with a `%` character.

You can use the `command` pattern to match any message that the first item in the message split on spaces matches the supplied pattern.  For example: `{command: '!myCommand'}` will match any message that starts with `!myCommand`.  The big difference between this and `startsWith` is that `startsWith` can have other input right after it, where `command` requires other input after the command to be separated by a space.

You can use the `regex` pattern to match any complex regular expression.  For example `{regex: new RegExp('!tail [0-9]+$')` matches `!tail` followed by a space and any number and nothing else.  You can also use regular expression literals.

### Flags

Two flags are currently considered:

`{stop: true}` will stop execution of the current pattern and no other matching patterns will be executed.  Use this with the priority option.

`{ignorePaused: true}` will allow the pattern to be executed even if the bot is paused in the current channel.  You generally should not use this flag.

## Pattern Execution Function API

For the different eventTypes, there are different arguments that will be passed to the registered function:

### eventType `message`

For eventType `message`, your function should use the signature `function (message, channel, user)`. All three arguments are objects (or classes).

#### `message` argument

`message` is an object that contains the following keys (at least):

`message.rawText` is the exact input that was given.  Many times this has extra stuff in it from slack - user and channel mentions are encoded in slack's format for instance.

`message.text` is what you probably want to do most of your processing with.  The input has been trimmed, and channels have been replaced with simple names, like `#general` as you probably expect.  `message.text` will always be defined, but could in certain circumstances be empty.

`message.parts` is `message.text` split on spaces, making it easy for you to destructure into your own parameters.

`message.isDirect` is a boolean flag that indicates if the message starts with a mention of the bot.

`message.channel` the channel id the message was sent to, same as `channel.id`

#### `channel` argument

`channel` is defined by the slack-client module.  These are the main things you need from it:

`channel.send()` is a method that takes a string that will be sent to that channel.

`channel.name` is the name (not including a `#`) of the channel

`channel.id` is the internal slack id of the channel.

#### `user` argument

`user` is defined by the slack-client module.

`user.name` is the users username.

`user.id` is the users internal slack id.

### eventType `presenceChange`

For the eventType `presenceChange`, your function should use the signature: `function (user, presence)`

`user` is the same as for `message` event type above.  `presence` is a string that indicates that users new status.

> Note: more eventTypes will likely be included in the future.


## Documentation todo:

Here are some other documentation points I hope to expand on in the future, but you can at least know they exist and can maybe look up how they work for yourself:

- `bot.botName` the username of the bot
- `bot.id` the slack id of the bot
- `bot.self` the slack user object of the bot
- `bot.redis` the redis connection
- `bot.startTime` the timestamp of when the instance started running
- `bot.setCooldown(key, timeoutInSeconds)` key can be an array of keys
- `bot.isOnCooldown(key, callback)` key can be an array of keys ~ callback should be (err, data)
- `bot.isChannelPaused(channel)` the channel object, not the channel name
- `bot.ops.isOp(user, callback)` the user object, not the user name ~ callback should be (err, data) ~ data = 1 for is an op
- `bot.makeMention(user)` takes a user object and returns a string which will make the output a mention of that user
- `bot.getUserForMention(input)` takes a mention like `<@Uxxxxxx>` and gives you a user object
- `bot.getChannelGroupOrDMByID(input)` takes an id and gives you the channel object -
- `bot.getUserByID(id)` takes a user id, gives a user object
- `bot.getUserByName(name)` takes the username string, gives a user object
