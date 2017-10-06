# Watney Help

### ^example.com

Will let you know if the bot is able to reach that website or not.

### !time

Displays the current time in UTC

### !8Ball

Displays an 8-ball response.  You can also get an 8-ball response by starting with a mention of the bot and ending with a question mark.

### !maxusers

Displays the most users that the bot has ever seen online at the same time.

### !roll

Roll some dice. 

- `!roll 1d20` rolls one 20-sided die. 
- `!roll 1d2 2d10 5d20` rolls one 2-sided die (coin flip), two 10-sided die, and five 20-sided die. 
- `!roll 2d10+5` rolls two 10-sided die and adds 5 to their sum. `-`, `/`, and `*` operators are also allowed; all operate on the sum. The displayed sum includes any modifiers.

Any time you roll more than one of the same type of die, both the individual rolls and their sum is displayed.

### !tail

Links to a gist of the last 50 messages in the current channel.

### !tail [x]

Links to a gist of the last x messages in the current channel.
 
### !tail [x] [channel]

Links to a gist of the last x messages in the specified chanel.

### !tail -len

Shows how many messages are stored for the current channel.

### !tail -len [channel]

Shows how many messages are stored for the specified channel.

### !tail -max

Shows how many messages the bot is configured to store per channel.  Once this limit is reached, the oldest messages will be purged.

## karma

### @user++
### @user: +1
### @user, +1
### +1 @user

Give karma to the user to show your appreciation.

### !karma @user

Displays the amount of karma and overall leaderboard position.

### !karmagiver @user

Displays the amount of karma given by this user and the overall karma giving leaderboard position.

### !karma

Displays the current karma leaderboard.

### !karmagiver[s]

Displays the current karma giving leaderboard.

### ?term

Lookup CMFL tags or functions, or any term for which a custom description has been provided.

### !lookup -export [md|markdown|text|json]

get a gist of all of the custom descriptions saved.

### !stats

Display statistics about how many messages have been sent in the current channel and who has participated the most. Also shows how long the bot has been running.

### !stats -all

Same as !stats but lists information for all channels the bot is participating in.

### !uptime

Shows how long the bot has been running.

### !raffle

See information on the active raffle.

### !ticket (in DM only)

Send a direct message to the bot's account to get a ticket to the raffle.

### !raffle -listTickets

See which members have tickets and how many.

### !admin {message}

Send a message to an admin group. You can use this command (like almost all commands) in a direct message if you want to be discreet. You will either get a notification that your message was sent, or a notification that the admin group has not been configured properly.
