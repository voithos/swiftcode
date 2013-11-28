# TODO

### Core features
* Add current player to 'opponents' list
* Add '1st', '2nd', etc place to 'opponents' list
* Modify color of opponent3 (red looks too much like an error)
* Spam protection in login process
* Modify home screen to provide overview of game
* Add automated tests to compare server-side typeable-detection with client-side typeable-to-DOM matching algorithm
* Back functionality for game type selection box
* Add keep-alive script to in-game and admin pages

### Bugs
* Sometimes can get locked inside a game, unable to create new games
* Error occurs after unjoining (playerCursor set to null, never set back?)
* Docstrings are not classified seperately by highlight.js, thus not excluded

### Possible future features
* Learning mode? (collaborate with 'Learn X in Y' project?)
* Profile page, where user can see stats, tweak settings
* Names / passwords / invitation-only option for game rooms
* Training mode? ("beat your own time")
* Dynamic favicon update in lobby page, when people login / logout
