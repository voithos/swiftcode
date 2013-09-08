var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var bcrypt = require('bcrypt');
var _ = require('lodash');
var moment = require('moment');
var hljs = require('./highlight.js');
var cheerio = require('cheerio');

var enet = require('./eventnet');

// Constant configs
var SALT_WORK_FACTOR = 10;
var GAME_TIME_JOIN_CUTOFF_MS = 5000;
var GAME_SINGLE_PLAYER_WAIT_TIME = 6;
var GAME_MULTI_PLAYER_WAIT_TIME = 16;
var GAME_DEFAULT_MAX_PLAYERS = 4;

var UserSchema = new Schema({
    username: { type: String, required: true, index: { unique: true } },
    password: { type: String, required: true },
    isAdmin: { type: Boolean, default: false },
    bestTime: { type: Number },
    bestSpeed: { type: Number },
    averageTime: { type: Number },
    averageSpeed: { type: Number },
    totalGames: { type: Number },
    totalMultiplayerGames: { type: Number },
    gamesWon: { type: Number },
    currentGame: { type: Schema.ObjectId, ref: 'GameSchema' }
});

// TODO: Look into using async library to avoid the spaghetti nesting
UserSchema.pre('save', function(next) {
    var user = this;

    if (!user.isModified('password')) {
        return next();
    }
    bcrypt.genSalt(SALT_WORK_FACTOR, function(err, salt) {
        if (err) {
            console.log(err);
            return next(err);
        }
        bcrypt.hash(user.password, salt, function(err, hash) {
            if (err) {
                console.log(err);
                return next(err);
            }
            user.password = hash;
            next();
        });
    });
});

UserSchema.methods.comparePassword = function(candidate, callback) {
    bcrypt.compare(candidate, this.password, function(err, isMatch) {
        if (err) {
            console.log(err);
            return callback(err);
        }
        callback(null, isMatch);
    });
};

UserSchema.methods.joinGame = function(game, callback) {
    var user = this;

    if (!game.checkJoinable(user._id)) {
        return callback('game is not joinable by this user', false);
    }

    user.currentGame = game._id;
    game.addPlayer(user._id, function(err) {
        if (err) {
            console.log(err);
            return callback('error joining game', false);
        }
        user.save(function(err) {
            if (err) {
                console.log(err);
                return callback('error saving user', false);
            }
            enet.emit('users:update', user);
            return callback(null, true, game);
        });
    });
};

UserSchema.methods.createGame = function(opts, callback) {
    var user = this;

    // User cannot create a game when he is already in one
    if (user.currentGame) {
        return callback('already in a game', false);
    }

    var game = new Game();
    _.extend(game, opts);

    game.creator = user._id;
    if (game.isSinglePlayer) {
        game.beginSinglePlayer();
    } else {
        game.beginMultiPlayer();
    }

    return user.joinGame(game, callback);
};

UserSchema.methods.quitCurrentGame = function(callback) {
    var user = this;
    if (user.currentGame) {
        Game.findById(user.currentGame, function(err, game) {
            if (err) {
                console.log(err);
                return callback('error retrieving game');
            }
            if (game) {
                game.removePlayer(user._id, function(err) {
                    if (err) {
                        console.log(err);
                        return callback(err);
                    }
                    user.currentGame = undefined;
                    user.save(function(err) {
                        if (err) {
                            console.log(err);
                            return callback('error saving user');
                        }
                        return callback(null, game);
                    });
                });
            }
        });
    } else {
        return callback();
    }
};

UserSchema.statics.resetCurrentGames = function() {
    var users = this;
    users.update({
        currentGame: { $exists: true }
    }, {
        $unset: { currentGame: true }
    }, {
        multi: true
    }, function(err) {
        if (err) {
            console.log(err);
        }
        console.log('users reset');
    });
};

// TODO: Create 'about' page that lists projects in use
// and links to their sites and licenses
var LangSchema = new Schema({
    key: { type: String },
    name: { type: String },
    projectName: { type: String },
    projectUrl: { type: String },
    projectCodeUrl: { type: String },
    projectLicenseUrl: { type: String },
    order: { type: Number },
    exercises: [Schema.ObjectId]
});

LangSchema.methods.randomExercise = function() {
    return this.exercises[Math.floor(Math.random() * this.exercises.length)];
};

var ExerciseSchema = new Schema({
    isInitialized: { type: Boolean },
    lang: { type: String },
    exerciseName: { type: String },
    code: { type: String },
    highlitCode: { type: String },
    commentlessCode: { type: String },
    typeableCode: { type: String },
    typeables: { type: Number }
});

var NON_TYPEABLES = ['comment', 'template_comment', 'diff', 'javadoc', 'phpdoc'];
var NON_TYPEABLE_CLASSES = _.map(NON_TYPEABLES, function(c) { return '.' + c; }).join(',');

ExerciseSchema.pre('save', function(next) {
    var exercise = this;
    if (!exercise.isInitialized) {
        exercise.initialize();
    }
    next();
});

ExerciseSchema.methods.initialize = function() {
    var exercise = this;
    exercise.normalizeNewlines();
    exercise.countTypeables();
    exercise.isInitialized = true;
};

ExerciseSchema.methods.normalizeNewlines = function() {
    var exercise = this;
    exercise.code = exercise.code.replace(/\r\n|\n\r|\r|\n/g, '\n');
};

ExerciseSchema.methods.countTypeables = function() {
    var exercise = this;
    exercise.code = exercise.code.replace(/(^\n+)|(\s+$)/g, '') + '\n';

    // Highlight.js doesn't always get it right with autodetection
    var highlight = (exercise.lang in hljs.LANGUAGES) ?
                    hljs.highlight(exercise.lang, exercise.code, true) :
                    hljs.highlightAuto(exercise.code);

    exercise.highlitCode = highlight.value;

    // Remove comments because we don't want the player to type out
    // a 500 word explanation for some obscure piece of code
    var $ = cheerio.load(exercise.highlitCode);
    $(NON_TYPEABLE_CLASSES).remove();

    exercise.commentlessCode = $.root().text();
    exercise.typeableCode = exercise.commentlessCode.replace(/(^[ \t]+)|([ \t]+$)/gm, '')
                            .replace(/\n+/g, '\n').trim() + '\n';
    exercise.typeables = exercise.typeableCode.length;
};

var GameSchema = new Schema({
    lang: { type: String, required: true },
    langName: { type: String },
    exercise: { type: Schema.ObjectId, ref: 'ExerciseSchema' },
    isSinglePlayer: { type: Boolean, default: false },
    numPlayers: { type: Number, min: 0, default: 0 },
    maxPlayers: { type: Number, min: 0, default: GAME_DEFAULT_MAX_PLAYERS },
    status: { type: String },
    statusText: { type: String },
    isJoinable: { type: Boolean, default: true },
    isComplete: { type: Boolean, default: false },
    isViewable: { type: Boolean, default: true },
    starting: { type: Boolean, default: false },
    started: { type: Boolean, default: false },
    startTime: { type: Date },
    creator: { type: Schema.ObjectId, ref: 'UserSchema' },
    winner: { type: Schema.ObjectId, ref: 'UserSchema' },
    winnerTime: { type: Number, min: 0 },
    winnerSpeed: { type: Number, min: 0 },
    players: [Schema.ObjectId],
    startingPlayers: [Schema.ObjectId],
    wasReset: { type: Boolean, default: false }
});

// TODO: Avoid emitting the games:update event so much; only when necessary
GameSchema.pre('save', function(next) {
    var game = this;

    if (game.isNew || game.isModified()) {
        game.setGameStatus();
    }
    return next();
});

GameSchema.methods.beginSinglePlayer = function() {
    var game = this;
    game.setStatus('waiting');
    game.isJoinable = false;
    game.isViewable = false;
    game.isComplete = false;
    game.maxPlayers = 1;
};

GameSchema.methods.beginMultiPlayer = function() {
    var game = this;
    game.setStatus('waiting');
    game.isJoinable = true;
    game.isViewable = true;
    game.isComplete = false;
    game.isSinglePlayer = false;
};

GameSchema.methods.updateGameStatus = function(callback) {
    var game = this;
    game.setGameStatus();
    game.save(function(err, game) {
        if (err) {
            console.log(err);
            return callback('error saving user');
        }
        enet.emit('games:update', game);
        return callback(null, game);
    });
};

GameSchema.methods.setGameStatus = function() {
    var game = this;

    if (game.numPlayers === game.maxPlayers) {
        game.isJoinable = false;
    }

    if (game.isSinglePlayer) {
        game.setGameStatusSinglePlayer();
    } else {
        game.setGameStatusMultiPlayer();
    }
};

GameSchema.methods.setGameStatusSinglePlayer = function() {
    var game = this;
    if (!game.starting) {
        game.starting = true;
        game.startTime = moment().add(GAME_SINGLE_PLAYER_WAIT_TIME, 'seconds').toDate();
    } else {
        game.updateTime();
    }
};

GameSchema.methods.setGameStatusMultiPlayer = function() {
    var game = this;

    if (game.started) {
        game.updateTime();
    } else if (game.starting) {
        // Starting interrupt condition
        if (game.numPlayers < 2) {
            game.starting = false;
            game.startTime = undefined;
            game.isJoinable = true;
        } else {
            game.updateTime();
        }
    } else {
        if (game.numPlayers > 1) {
            game.starting = true;
            game.startTime = moment().add(GAME_MULTI_PLAYER_WAIT_TIME, 'seconds').toDate();
        }
    }
};

GameSchema.methods.updateTime = function() {
    var game = this;
    var timeLeft = moment(game.startTime).diff(moment());
    if (game.isJoinable && !game.started) {
        if (timeLeft < GAME_TIME_JOIN_CUTOFF_MS) {
            game.isJoinable = false;
        }
    } else if (timeLeft < 0) {
        if (timeLeft < 0) {
            game.start();
        }
    }
};

GameSchema.methods.setStatus = function(status) {
    var bindings = {
        'waiting': 'Waiting',
        'ingame': 'In game'
    };
    this.status = status;
    this.statusText = bindings[status];
};

GameSchema.methods.checkJoinable = function(player) {
    var game = this;
    return (game.isJoinable || game.isSinglePlayer) && !_.contains(game.players, player);
};

GameSchema.methods.addPlayer = function(player, callback) {
    var game = this;

    var wasNew = game.isNew;
    game.players.push(player);
    game.numPlayers += 1;

    game.save(function(err, game) {
        if (err) {
            console.log(err);
            return callback('error saving game', false);
        }
        if (wasNew) {
            enet.emit('games:new', game);
        } else {
            enet.emit('games:update', game);
        }

        return callback(null, game);
    });
};

GameSchema.methods.removePlayer = function(player, callback) {
    var game = this;
    game.players.remove(player);
    game.numPlayers = game.numPlayers <= 0 ? 0 : game.numPlayers - 1;

    if (game.numPlayers === 0) {
        game.finish();
    }

    game.save(function(err) {
        if (err) {
            console.log(err);
            return callback('error saving game');
        }
        if (game.isComplete) {
            enet.emit('games:remove', game);
        } else {
            enet.emit('games:update', game);
        }

        return callback(null, game);
    });
};

GameSchema.methods.start = function() {
    var game = this;
    game.started = true;
    game.startingPlayers = game.players.slice();
    game.setStatus('ingame');
    game.isJoinable = false;
};

GameSchema.methods.finish = function() {
    var game = this;
    game.isComplete = true;
    game.isViewable = false;
    game.isJoinable = false;
};

GameSchema.statics.resetIncomplete = function() {
    var games = this;
    games.update({
        $or: [{ isComplete: false }, { isViewable: true }]
    }, {
        isComplete: true,
        isViewable: false,
        numPlayers: 0,
        players: [],
        isJoinable: false,
        wasReset: true
    }, {
        multi: true
    }, function(err) {
        if (err) {
            console.log(err);
        }
        console.log('games reset');
    });
};

var User = mongoose.model('User', UserSchema);
var Lang = mongoose.model('Lang', LangSchema);
var Exercise = mongoose.model('Exercise', ExerciseSchema);
var Game = mongoose.model('Game', GameSchema);

module.exports.User = User;
module.exports.Lang = Lang;
module.exports.Exercise = Exercise;
module.exports.Game = Game;

module.exports.NON_TYPEABLES = NON_TYPEABLES;
module.exports.NON_TYPEABLE_CLASSES = NON_TYPEABLE_CLASSES;
