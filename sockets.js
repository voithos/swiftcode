var io = require('socket.io');

var models = require('./models');
var enet = require('./eventnet');

var SwiftCODESockets = function() {
    var self = this;

    self.listen = function(server) {
        self.io = server;
        self.io.set('log level', 1);

        self.setupListeners();
    };

    self.configureForOpenShift = function() {
        self.io.set('transports', ['websocket']);
    };

    /**
     * Setup socket listeners
     */
    self.setupListeners = function() {
        // TODO: Rearchitect the lobby/game connections to remove possibility
        // of dangling games
        var lobby = self.io.of('/lobby')
        .on('connection', function(socket) {
            socket.on('games:fetch', function(data) {
                models.Game.find({ isViewable: true }, function(err, docs) {
                    socket.emit('games:fetch:res', docs);
                });
            });

            socket.on('games:join', function(data) {
                models.User.findById(data.player, function(err, user) {
                    if (err) {
                        console.log(err);
                        console.log('games:join error'); return;
                    }
                    models.Game.findById(data.game, function(err, game) {
                        if (err) {
                            console.log(err);
                            console.log('games:join error'); return;
                        }
                        user.joinGame(game, function(err, success, game) {
                            if (err) {
                                console.log(err);
                                console.log('games:join error'); return;
                            }
                            socket.emit('games:join:res', { success: success, game: game });
                        });
                    });
                });
            });

            socket.on('games:createnew', function(data) {
                models.Lang.findOne({ key: data.key }, function(err, lang) {
                    if (lang) {
                        models.User.findById(data.player, function(err, user) {
                            user.createGame({
                                lang: lang.key,
                                langName: lang.name,
                                maxPlayers: 4,
                                exercise: lang.randomExercise()
                            }, function(err, success, game) {
                                if (err) {
                                    console.log(err);
                                    console.log('games:createnew error'); return;
                                }
                                socket.emit('games:createnew:res', { success: success, game: game });
                            });
                        });
                    } else {
                        console.log('No such game type: ' + data.key);
                    }
                });
            });
        });

        var game = self.io.of('/game')
        .on('connection', function(socket) {
            socket.on('ingame:ready', function(data) {
                socket.set('player', data.player, function() {
                    models.User.findById(data.player, function(err, user) {
                        if (err) {
                            console.log(err);
                            console.log('ingame:ready error'); return;
                        }
                        if (user) {
                            models.Game.findById(user.currentGame, function(err, game) {
                                if (game) {
                                    if (err) {
                                        console.log(err);
                                        console.log('ingame:ready error'); return;
                                    }
                                    models.Exercise.findById(game.exercise, 'code typeableCode typeables', function(err, exercise) {
                                        if (exercise) {
                                            // Join a room
                                            socket.join('game-' + game.id);
                                            socket.emit('ingame:ready:res', {
                                                game: game,
                                                exercise: exercise,
                                                nonTypeables: models.NON_TYPEABLE_CLASSES
                                            });
                                        } else {
                                            console.log('lang and exercise not found');
                                        }
                                    });
                                }
                            });
                        }
                    });
                });
            });

            socket.on('ingame:ping', function(data) {
                models.Game.findById(data.gameId, function(err, game) {
                    if (err) {
                        console.log(err);
                        console.log('ingame:ping error'); return;
                    }
                    if (game) {
                        game.updateGameStatus(function(err, game) {
                            if (err) {
                                console.log(err);
                                console.log('ingame:ping error'); return;
                            }
                            socket.emit('ingame:ping:res', { game: game });
                        });
                    }
                });
            });

            socket.on('disconnect', function() {
                socket.get('player', function(err, player) {
                    if (err) {
                        console.log(err);
                        return;
                    }
                    models.User.findById(player, function(err, user) {
                        if (err) {
                            console.log(err);
                            console.log('ingame:exit error'); return;
                        }
                        if (user) {
                            user.quitCurrentGame(function(err, game) {
                                if (err) {
                                    console.log(err);
                                    console.log('ingame:exit error'); return;
                                }
                            });
                        }
                    });
                });
            });
        });

        enet.on('games:new', function(game) {
            lobby.emit('games:new', game);
        });

        enet.on('games:update', function(game) {
            lobby.emit('games:update', game);
        });

        enet.on('games:remove', function(game) {
            lobby.emit('games:remove', game);
        });
    };
};

module.exports = SwiftCODESockets;
