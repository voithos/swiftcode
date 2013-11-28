'use strict';

var io = require('socket.io');
var moment = require('moment');

var models = require('./models');
var enet = require('./eventnet');

var SwiftCODESockets = function() {
    var self = this;

    self.listen = function(server) {
        self.io = server;
        self.io.set('log level', 1);

        self.setupListeners();
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
                                exercise: lang.randomExercise(),
                                isSinglePlayer: data.gameType === 'single'
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
                            socket.set('game', user.currentGame);
                            models.Game.findById(user.currentGame, function(err, game) {
                                if (game) {
                                    if (err) {
                                        console.log(err);
                                        console.log('ingame:ready error'); return;
                                    }
                                    models.Exercise.findById(game.exercise, 'code projectName typeableCode typeables', function(err, exercise) {
                                        if (exercise) {
                                            // Join a room and broadcast join
                                            socket.join('game-' + game.id);
                                            socket.broadcast.to('game-' + game.id).emit('ingame:join', {
                                                player: user,
                                                game: game
                                            });

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
                socket.get('game', function(err, game) {
                    if (err) {
                        console.log(err);
                        return;
                    }
                    models.Game.findById(game, function(err, game) {
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
                                // Client-side clocks cannot be relied upon to
                                // be synchronized, so we specify the time left
                                // directly from the server
                                socket.emit('ingame:ping:res', {
                                    game: game,
                                    timeLeft: moment().diff(game.startTime)
                                });
                            });
                        }
                    });
                });
            });

            socket.on('ingame:complete', function(data) {
                socket.get('player', function(err, player) {
                    if (err) {
                        console.log(err);
                        return;
                    }
                    socket.get('game', function(err, game) {
                        if (err) {
                            console.log(err);
                            return;
                        }
                        
                        var stats = new models.Stats({
                            player: player,
                            game: game,
                            time: data.time,
                            keystrokes: data.keystrokes,
                            mistakes: data.mistakes
                        });

                        stats.updateStatistics(function(err, stats, user, game) {
                            if (err) {
                                console.log(err);
                                return;
                            }
                            socket.emit('ingame:complete:res', {
                                stats: stats,
                                game: game
                            });
                        });
                    });
                });
            });

            socket.on('ingame:advancecursor', function(data) {
                socket.broadcast.to('game-' + data.game).emit('ingame:advancecursor', {
                    player: data.player,
                    game: data.game
                });
            });

            socket.on('report:highlightingerror', function(data) {
                models.Exercise.findById(data.exercise, function(err, exercise) {
                    if (exercise) {
                        exercise.highlightingErrorReports++;
                        exercise.save();
                    }
                });
            });

            socket.on('disconnect', function() {
                socket.get('game', function(err, game) {
                    if (err) {
                        console.log(err);
                        return;
                    }
                    socket.get('player', function(err, player) {
                        if (err) {
                            console.log(err);
                            return;
                        }
                        // Emit a 'leave' notice to other players in the room
                        socket.broadcast.to('game-' + game).emit('ingame:leave', {
                            player: player,
                            game: game
                        });

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
        });

        enet.on('games:new', function(game) {
            if (game.isViewable) {
                lobby.emit('games:new', game);
            }
        });

        enet.on('games:update', function(game) {
            if (game.isViewable) {
                lobby.emit('games:update', game);
            }
        });

        enet.on('games:remove', function(game) {
            // By definition, a game must be removed when it isn't viewable
            lobby.emit('games:remove', game);
        });
    };
};

module.exports = SwiftCODESockets;
