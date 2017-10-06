# Guidelines for Contributing to Watney

Contributions of all shapes and sizes are welcome, encouraged, and greatly appreciated!

For all contributions, you'll need a [free GitHub account](https://github.com/signup/free).

If you are going to develop on @watney, make sure you check out the [dev-help](https://github.com/ryanguill/watney/blob/master/dev-help.md) first.

## Bug Reports / Feature Requests

Ideally, please include all of the following information in your ticket:

If you are running your own version of watney and have access to the code / logs:

	* any log output
	* stacktrace, hopefully with the error and line numbers
	* if you are running an old node or alternate syntax that might be surprising it might be worth mentioning
	
If you are just a user who interacted with an instance of @watney and noticed and issue or had an idea:

	* the relevant conversation
	* the room that you had the conversation in, if applicable
	* if it was a public channel, group or DM	

## Documentation

PRs for just documentation is certainly welcome! If you add a new feature, please add the appropriate help and ops-help information for others.

## Code

> **Working on your first Pull Request?** You can learn how from this *free* series [How to Contribute to an Open Source Project on GitHub](https://egghead.io/series/how-to-contribute-to-an-open-source-project-on-github)

Currently development happens on master, but nothing will be committed to master that isn't ready for production.  Large features may be developed in branches.  If it is a major feature you are writing, please consider talking through it in an issue first.  

1. Fork the project
1. Clone to your local machine
1. Create a feature branch for your changes
1. Make your changes and commit them.
1. If your changes take a while, make sure you create an upstream remote and rebase changes.
1. Push your changes back to your fork. `git push -u origin BRANCH_NAME`
1. Send a pull request ([help with pull requests](https://help.github.com/articles/using-pull-requests))
  * Please make sure you select **master** as the destination branch unless otherwise directed.
