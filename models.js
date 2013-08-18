var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    bcrypt = require('bcrypt'),
    _ = require('lodash'),
    moment = require('moment'),
    SALT_WORK_FACTOR = 10;

var UserSchema = new Schema({
    username: { type: String, required: true, index: { unique: true } },
    password: { type: String, required: true },
    bestTime: { type: Number },
    bestSpeed: { type: Number },
    gamesWon: { type: Number },
    totalGames: { type: Number },
    currentGame: { type: Schema.ObjectId, ref: 'GameSchema' }
});

UserSchema.pre('save', function(next) {
    var user = this;

    if (!user.isModified('password')) {
        return next();
    }
    bcrypt.genSalt(SALT_WORK_FACTOR, function(err, salt) {
        if (err) {
            return next(err);
        }
        bcrypt.hash(user.password, salt, function(err, hash) {
            if (err) {
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
            return callback(err);
        }
        callback(null, isMatch);
    });
};

UserSchema.methods.joinGame = function(game, callback) {
    var user = this;
    user.currentGame = game._id;
    game.players.push(user._id);
    game.numPlayers += 1;

    game.save(function(err) {
        if (err) return callback('error saving game');
        user.save(function(err) {
            if (err) return callback('error saving user');
            callback(null, game);
        });
    });
};

UserSchema.methods.createGame = function(opts, callback) {
    var user = this;
    var game = new Game();
    _.forOwn(opts, function(v, k) {
        if (k in game) {
            game[k] = v;
        }
    });

    game.setStatus('waiting');
    game.isJoinable = true;
    game.isComplete = false;
    game.creator = user._id;

    user.joinGame(game, callback);
};

UserSchema.methods.quitCurrentGame = function(callback) {
    var user = this;
    if (user.currentGame) {
        Game.findById(user.currentGame, function(err, game) {
            if (err) return callback('error retrieving game');
            if (game) {
                game.players.remove(user._id);
                game.numPlayers -= 1;
                if (game.numPlayers <= 0) {
                    game.isComplete = true;
                }
                game.save(function(err) {
                    if (err) return callback('error saving game');
                    user.currentGame = undefined;
                    user.save(function(err) {
                        if (err) return callback('error saving user');
                        callback(null, game);
                    });
                });
            }
        });
    } else {
        callback();
    }
};

var GameSchema = new Schema({
    lang: { type: String, required: true },
    langName: { type: String },
    partFile: { type: String },
    numPlayers: { type: Number, min: 0, default: 0 },
    maxPlayers: { type: Number, min: 0 },
    status: { type: String },
    statusText: { type: String },
    isJoinable: { type: Boolean, default: true },
    isComplete: { type: Boolean, default: false },
    starting: { type: Boolean, default: false },
    started: { type: Boolean, default: false },
    startTime: { type: Date },
    creator: { type: Schema.ObjectId, ref: 'UserSchema' },
    winner: { type: Schema.ObjectId, ref: 'UserSchema' },
    winnerTime: { type: Number, min: 0 },
    winnerSpeed: { type: Number, min: 0 },
    players: [Schema.ObjectId]
});

GameSchema.pre('save', function(next) {
    var game = this;

    if (game.isModified('numPlayers')) {
        if (game.numPlayers == game.maxPlayers) {
            game.isJoinable = false;
        }
    }
    return next();
});

GameSchema.methods.setStatus = function(status) {
    var bindings = {
        'waiting': 'Waiting',
        'ingame': 'In game'
    };
    this.status = status;
    this.statusText = bindings[status];
};

GameSchema.methods.updateGameStatus = function(callback) {
    var game = this;
    var modified = false;
    if (game.starting) {
        if (game.numPlayers < 2) {
            game.starting = false;
            game.startTime = undefined;
            game.isJoinable = true;
            modified = true;
        } else {
            var timeLeft = moment(game.startTime).diff(moment());
            if (game.isJoinable) {
                if (timeLeft < 5000) {
                    game.isJoinable = false;
                    modified = true;
                }
            }
            if (!game.isJoinable) {
                if (timeLeft < 0) {
                    game.started = true;
                    game.setStatus('ingame');
                    modified = true;
                }
            }
        }
    } else {
        if (game.numPlayers > 1) {
            game.starting = true;
            game.startTime = moment().add(15, 'seconds').toDate();
            modified = true;
        }
    }

    if (modified) {
        game.save(function(err) {
            if (err) return callback('error saving user');
            return callback(null, modified, game);
        });
    } else {
        return callback(null, modified, game);
    }
};

var User = mongoose.model('User', UserSchema);
var Game = mongoose.model('Game', GameSchema);

module.exports.User = User;
module.exports.Game = Game;
