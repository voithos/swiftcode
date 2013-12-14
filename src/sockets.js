'use strict';

var io = require('socket.io');
var moment = require('moment');
var util = require('util');

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
        var lobbyCount = 0;

        var lobbySockets = self.io.of('/lobby')
        .on('connection', function(socket) {
            socket.on('games:fetch', function(data) {
                models.Game.find({ isViewable: true }, function(err, docs) {
                    socket.emit('games:fetch:res', docs);
                });
            });

            socket.on('games:join', function(data) {
                models.User.findById(data.player, function(err, user) {
                    if (err) {
                        util.log(err);
                        util.log('games:join error'); return;
                    }
                    if (user) {
                        user.prepareIngameAction('join', {
                            game: data.game
                        }, function(err) {
                            if (err) {
                                util.log(err);
                            }
                            socket.emit('games:join:res', { success: !err });
                        });
                    }
                });
            });

            socket.on('games:createnew', function(data) {
                models.User.findById(data.player, function(err, user) {
                    if (err) {
                        util.log(err);
                        util.log('games:join error'); return;
                    }
                    if (user) {
                        user.prepareIngameAction('createnew', {
                            lang: data.key,
                            isSinglePlayer: data.gameType === 'single'
                        }, function(err) {
                            if (err) {
                                util.log(err);
                            }
                            socket.emit('games:createnew:res', { success: !err });
                        });
                    }
                });
            });

            socket.on('disconnect', function() {
                lobbyCount--;
                lobbySockets.emit('lobbycount', { count: lobbyCount });
            });

            lobbyCount++;
            lobbySockets.emit('lobbycount', { count: lobbyCount });
        });

        var gameSockets = self.io.of('/game')
        .on('connection', function(socket) {
            socket.on('ingame:ready', function(data) {
                socket.set('player', data.player, function() {
                    models.User.findById(data.player, function(err, user) {
                        if (err) {
                            util.log(err);
                            util.log('ingame:ready error');
                            return socket.emit('ingame:ready:res', {
                                success: false,
                                err: err
                            });;
                        }
                        if (user) {
                            user.performIngameAction(function(err, success, game) {
                                if (!success) {
                                    return socket.emit('ingame:ready:res', {
                                        success: false,
                                        err: err
                                    });
                                }

                                socket.set('game', game.id);
                                models.Exercise.findById(game.exercise, 'code projectName typeableCode typeables', function(err, exercise) {
                                    if (exercise) {
                                        // Join a room and broadcast join
                                        socket.join('game-' + game.id);

                                        socket.emit('ingame:ready:res', {
                                            success: true,
                                            game: game,
                                            timeLeft: game.starting ? moment().diff(game.startTime) : undefined,
                                            exercise: exercise,
                                            nonTypeables: models.NON_TYPEABLE_CLASSES
                                        });
                                    } else {
                                        util.log('exercise not found');
                                        socket.emit('ingame:ready:res', {
                                            success: false,
                                            err: 'exercise not found'
                                        });
                                    }
                                });
                            });
                        }
                    });
                });
            });

            socket.on('ingame:complete', function(data) {
                socket.get('player', function(err, player) {
                    if (err) {
                        util.log(err);
                        return;
                    }
                    socket.get('game', function(err, game) {
                        if (err) {
                            util.log(err);
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
                                util.log(err);
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

            socket.on('ingame:retreatcursor', function(data) {
                socket.broadcast.to('game-' + data.game).emit('ingame:retreatcursor', {
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
                        util.log(err);
                        return;
                    }
                    socket.get('player', function(err, player) {
                        if (err) {
                            util.log(err);
                            return;
                        }
                        models.User.findById(player, function(err, user) {
                            if (err) {
                                util.log(err);
                                util.log('ingame:exit error'); return;
                            }
                            if (user) {
                                user.quitCurrentGame(function(err, game) {
                                    if (err) {
                                        util.log(err);
                                        util.log('ingame:exit error'); return;
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
                lobbySockets.emit('games:new', game);
            }
        });

        enet.on('games:update', function(game) {
            if (game.isViewable) {
                lobbySockets.emit('games:update', game);
            }
            gameSockets.in('game-' + game.id).emit('ingame:update', {
                game: game,
                timeLeft: moment().diff(game.startTime)
            });
        });

        enet.on('games:remove', function(game) {
            // By definition, a game must be removed when it isn't viewable
            lobbySockets.emit('games:remove', game);
        });

    };
};

module.exports = SwiftCODESockets;
