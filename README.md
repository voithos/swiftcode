# SwiftCODE

SwiftCODE is a multiplayer, interactive, realtime typing speed game
for coders. It is designed as a full webapp using some of the newest and most
interesting pieces of HTML5.

### How to play

The app is built around 3 main pages.

- Upon navigating to the project URL, the user will be presented with a greeting
  page where they can log in or sign up (all that is needed is a username and
  password; no email).

- After logging in, the user is redirected to the lobby, where the currently
  active games are shown. From here, they can choose to join a game or create
  their own from a set of preconfigured languages (**unfortunately, JavaScript
  is the only language that works in this version of SwiftCODE. In fact,
  clicking any other language will CRASH the server, so please only choose
  JavaScript**).

- Once the user has created or joined a game, they are redirected to the game
  screen where the sample code loads. There they wait until another user joins
  their game, after which the countdown is supposed to begin (sadly, that's all
  that was completed this time).

### Vision

As programmers, we rely on many tools while coding. A keyboard is
usually the most basic and most important of all such tools. And although there
are more important skills that a developer must have than typing speed, it's
still great fun to hear the keys clicking away as you furiously write out some
code. In fact, it's so fun, why not make it into a game? And a multiplayer one
at that!

In the past, I've enjoyed typing games, but there is a large difference between
typing natural language, and typing code (even the programming language can make
a difference!). I had found [Typing.io](http://typing.io/) a while back, which
is great fun - but unfortunately doesn't support any kind of multiplayer.

The goal of this project was to fill that gap - to create a multiplayer,
interactive, typing game for developers! I envisioned multiple players
simultaneously receiving a piece of code, getting ready, and then racing each
other to type out the code, all while streaming the progress of each player to
his opponents, and animating their progress via multiple cursors on the player's
screen.

### What I finished

- Full user system, with log in/sign up interface, and error handling (spent too
  much time on this)
- Lobby, with realtime updates to state of currently active games, and ability
  to join games or create new ones (again, spent too much time)
- Game room, with streaming, loading, and display of code

### What I didn't finish, but _really_ wanted to

- The actual typing part (epic fail...? I _do_ want to finish this)
- Seeing the progress of your opponents
- Ending the game when the player finishes

### What I didn't finish, but would have been nice

- More languages! (this is actually easy to add, but I saved it until the end,
  and then ran out of time)
- A better in-game dashboard (perhaps showing your opponents' names, and colors)
- Metrics like typing speed, timing, mistakes, etc.
- A user screen where the player can view his own statistics (perhaps
  per-language) and modify his info.
- An improved lobby, perhaps with user-definable names for the game rooms
- Anti-cheat? Perhaps just a simple hard-limit on a typing speed (i.e. don't
  allow hundreds of keystrokes per second)

### Open Source

Without open source technologies and libraries, this project
would not be possible. A great thanks goes to all of their creators. Listed in
no particular order:

- Node.js
- Express
- Socket.IO
- MongoDB and Mongoose
- Bootstrap
- jQuery
- Knockout.js
- Highlight.js
- Lo-dash
- Moment.js
- Jade
- Passport
- And of course, HTML5 itself!
