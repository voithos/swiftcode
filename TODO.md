# TODO

### Core features
* Add multiplayer end screen
* Spam protection in login process
* Modify home screen to provide overview of game
* Auto-scrolling in-game
* Add automated tests to compare server-side typeable-detection with client-side typeable-to-DOM matching algorithm
* Back functionality for game type selection box

### Bugs
* Session timeouts seem to not be refreshing
* Sometimes can get locked inside a game, unable to create new games
* Error occurs after unjoining (playerCursor set to null, never set back?)
* Server multiplayer game end state is throwing an error
* Docstrings are not classified seperately by highlight.js, thus not excluded

### Possible future features
* Learning mode? (collaborate with 'Learn X in Y' project?)
* Profile page, where user can see stats, tweak settings
* Names / passwords / invitation-only option for game rooms
* Training mode? ("beat your own time")
* Dynamic favicon update in lobby page, when people login / logout
