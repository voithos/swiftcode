# SwiftCODE

SwiftCODE is a multiplayer, interactive, realtime typing speed game
for coders.

## How to play

The app is built around 2 main pages.

- After logging in, or choosing to be anonymous, the user is redirected to the
  lobby, where the currently active games are shown. From here, they can choose
  to join a game or create their own (either single-player or multiplayer) from
  a set of preconfigured programming languages.

- Once the user has created or joined a game, they are redirected to the game
  screen where the code snippet loads. There they wait until another user joins
  their game, after which the countdown begins. Each game can have a maximum of
  4 players. Once the game starts, players must type the provided code as fast
  as possible. Throughout this, the players' current positions are shown to
  each other in real-time, and at the end some statistics are shown.

## Vision

As programmers, we rely on many tools while coding. A keyboard is usually the
most basic and most important of all such tools. Of course, there are far more
important skills that a developer must have than typing speed. That being said,
however, it's still great fun to hear the keys clicking away as you furiously
write out some code. In fact, it's so fun, why not make it into a game? And a
multiplayer one at that!

In the past, I've enjoyed typing games, but there is a large difference between
typing natural language, and typing code (even the choice of programming
language can make a significant difference!). I had found
[Typing.io](http://typing.io/) a while back, which is great fun - but
unfortunately doesn't support any kind of multiplayer.

The goal of this project was to fill that gap - to create a multiplayer,
interactive, typing game for developers! I envisioned multiple players
simultaneously receiving a piece of code, getting ready, and then racing each
other to type out the code, all while streaming the progress of each player to
his opponents, and animating their progress via multiple cursors on the
player's screen.

## Installation

### Requirements

- Node.js and NPM
- MongoDB

### Download

Grab the source code and the dependencies.

    git clone https://github.com/voithos/swiftcode.git
    cd swiftcode
    npm install

### Configure

Create a database in MongoDB for SwiftCODE, and create a MongoDB user
account that SwiftCODE will use to connect.

    mongo
    > use swiftcode
    > db.addUser({ user: 'swiftcodeuser', pwd: 'password', roles: ['readWrite'] })

Copy the sample `settings.js.example.js` file to `settings.js`, and fill out
the settings as desired (specifically, you must provide the database settings
to your MongoDB).

    cd src
    cp settings.js.example.js settings.js
    vim settings.js

SwiftCODE does not come with code exercises preloaded, but does have a simple
admin interface which allows for the definition of new languages, projects, and
exercises. An admin user is required to access the interface, which can be
created through grunt (note, this requires the database settings to be in
place).

    grunt add-admin

Once an admin user has been added, the admin interface can be accessed after
logging in, using the link in the drop-down in the top-right corner of the
page.

### Run

At this point, SwiftCODE should be fully set up, and runnable.

    ./runserver.js

Success!

## Open Source

Without open source technologies and libraries, this project would not be
possible. A great thanks goes to all of their creators. Listed in no particular
order:

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
- Cheerio
- Helmet
- Alertify
- Mousetrap
- And of course, HTML5 itself!
