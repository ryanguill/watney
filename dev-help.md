# Development Help

So you want to contribute to watney? Or maybe fork it and use in your own slack room with your own integrations? Here is a few topics that will help.  

Definitely read these things if you plan on contributing back to Watney itself.

# Setup

Getting started should be as simple as:

- Fork the repo on github
- Clone your fork locally
- use `npm install` to install the dependencies
- copy `lib/config.json` to `lib/config.user.json`
- Note: if you want to develop in the cfml slack room, contact an admin for an api key and you can skip these next steps
- - go to the slack room that you want to integrate with, 'Configure Integrations' 
- - search for 'bots' and add that integration
- - come up with a username for your bot and get an api key
- update `lib.config.user.json` with appropriate values, your api key and your bot's username especially. You probably want to ignore the #general room - you cannot remove your bot from that room and probably don't want to spam it while you develop.
- run `node main.js` to connect and test!

That may have seemed complicated, but really shouldn't more than a few minutes.

# Notes

`main.js` is written using ES5 level node.js code.  This bootstraps the whole process, and for most development you shouldn't need to modify it.  

The project uses babel though to allow us to write ES6 (ES2015)+ level code in all of the plugins.  All local modules (not nmp dependencies) loaded will be transpiled automatically, so you can use ES5 plus to develop them.  If you are more comfortable sticking with ES5, go for it!  If you are trying to update an existing module written in ES6, try to match style though.
 
The only sticking point about transpiling from ES6 is that debugging can be difficult with many editors (although that should be improving).  You can use `console.log` of course though and there is also `bot.log()` available in plugins that works the same way but only actually logs when configured with `debug: true` in your `config.user.json` file.

# Plugin API

There are really on a few things to know about how to write a new plugin.  The first is how to register your interest in different events.

All plugins should use this basic template:

```
module.exports = (function(){
	
	let bot;
	
	return function init (_bot) {
		bot = _bot;
			
		bot.register(
			//pattern
		});
		
		//more pattern registrations
	});
})();
```

the `bot` parameter passed to the `init` method contains many helpful resources and functions that will be documented more as time goes on.  One of the big ones is `bot.redis` which can be used to persist data.  Look at the ops plugin for a relatively simple example of how to use redis, although a lot of plugins use it so look around if you need more examples.

## Pattern registration

There are currently two different event types (although this will almost certainly grow soon): `message` (the default) and `presenceChange`.
  
There are currently two different types of registrations, `IN` and `OUT`.  `IN` is for when you just want to take in input, but don't expect to send any response.  `OUT` signals that you want to send a response.

You can use multiple pattern registrations pointing to the same function if you want to allow multiple inputs to use the same processing.

To register your plugins interest in a pattern, call `bot.register` and pass an object with the following keys. If you want to pass the default value for a key, you can omit that key entirely.

```
{
	pattern: {},  //required, see more information below
	f: functionName, //required, a reference to the function that you want called when a message comes through that matches this pattern
	type: 'OUT', //required, either 'OUT' or 'IN' - you must use 'OUT' if you intend to send responses
	eventType: 'message', //defaults to 'message', currently can be either 'message' or 'presenceChange' - this value determines what is sent to the function
	priority: 1000, //defaults to 1000 - can be used to make sure that certain registrations are executed before or after other patterns, even in other plugins, relative to the type.  'IN' patterns always execute before 'OUT' patterns.
	flags: {} //an object - defaults to an empty object.  Setting keys inside of this object to true can alter execution - see more information below
}
```

### Pattern Options

Currently, pattern objects can use the following keys, which can be combined.  Pattern matching works on exclusion, patterns are considered matched until they encounter a rule that fails.

An empty pattern object matches everything `{}`.

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
