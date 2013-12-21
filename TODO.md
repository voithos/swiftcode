# TODO

### Core features
* Spam protection in login process
* Add automated tests to compare server-side typeable-detection with client-side typeable-to-DOM matching algorithm
* Better anti-cheat
* Add method to kick out inactive users
* Figure out a proper ordering for the lobby games
* Allow single user to play multi-player, to allow multi-player to get started when few users are online.

### Bugs
* Error occurs after unjoining (playerCursor set to null, never set back?)
* Docstrings are not classified seperately by highlight.js, thus not excluded
* Certain keys don't work under Opera (for example, underscore is treated as '-')
* When multiple players join around the same time, some may not get "ingame:join" updates
* Foreign keyboard don't work (Mousetrap problem?)

### Possible future features
* Learning mode? (collaborate with 'Learn X in Y' project?)
* Profile page, where user can see stats, tweak settings
* Names / passwords / invitation-only option for game rooms
* Training mode? ("beat your own time")
* Dynamic favicon update in lobby page, when people login / logout (know how many people are in lobby)
* Badges / leaderboard?
* Show statistics of opponents, after they win?
