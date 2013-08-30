#!/bin/env node

var express = require('express');
var io = require('socket.io');
var http = require('http');

var path = require('path');
var _ = require('lodash');
var fs = require('fs');

// Routes and models
var routes = require('./routes');
var models = require('./models');

var mongoose = require('mongoose');

// Auth libs
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var flash = require('connect-flash');

var ensureAuthenticated = function(url, admin) {
    return function(req, res, next) {
        if (!req.isAuthenticated || !req.isAuthenticated()) {
            return res.redirect(url);
        } else if (admin && (!req.user || !req.user.isAdmin)) {
            return res.redirect(url);
        }
        next();
    };
};

/**
 * Configuration app for SwiftCODE
 */
var SwiftCODEConfig = function() {
    // Setup configuration from the environment
    var self = this;

    // Setup a flag indicating if we're in OpenShift or not
    self.openshift = !!process.env.OPENSHIFT_APP_DNS;
    self.repo = process.env.OPENSHIFT_REPO_DIR || './';

    self.ipaddress = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';
    self.port = process.env.OPENSHIFT_NODEJS_PORT || 8080;

    self.mongodb = {
        dbname: 'swiftcode',
        host: process.env.OPENSHIFT_MONGODB_DB_HOST || 'localhost',
        port: process.env.OPENSHIFT_MONGODB_DB_PORT || 27017,
        username: process.env.OPENSHIFT_MONGODB_DB_USERNAME || 'admin',
        password: process.env.OPENSHIFT_MONGODB_DB_PASSWORD || 'password'
    };
};

var SwiftCODE = function() {
    var self = this;

    /**
     * Listen on the configured port and IP
     */
    self.listen = function() {
        self.server = http.createServer(self.app);
        self.io = io.listen(self.server);
        self.io.set('log level', 1);
        if (self.config.openshift) {
            self.io.set('transports', ['websocket']);
        }
        self.server.listen(self.config.port, self.config.ipaddress);
        console.log('Listening at ' + self.config.ipaddress + ':' + self.config.port);

        self._setupSockets();
    };

    self._initialize = function() {
        self._setupConfig();
        self._setupDb();
        self._setupAuth();
        self._setupApp();
        self._setupRoutes();
    };

    self._setupConfig = function() {
        self.config = new SwiftCODEConfig();
    };

    /**
     * Setup database connection
     */
    self._setupDb = function() {
        mongoose.connect('mongodb://' + self.config.mongodb.host + ':' + self.config.mongodb.port + '/' + self.config.mongodb.dbname, {
            user: self.config.mongodb.username,
            pass: self.config.mongodb.password
        });

        // On startup, set all previous games to complete
        models.Game.update({ isComplete: false },
                           { isComplete: true, numPlayers: 0, players: [], isJoinable: false },
                           function(err) {
                               if (err) {
                                   console.log(err);
                               }
                               console.log('games reset');
                           });
    };

    /**
     * Setup authentication and user config
     */
    self._setupAuth = function() {
        passport.use(new LocalStrategy(function(username, password, done) {
            models.User.findOne({ username: username }, function(err, user) {
                if (err) {
                    console.log(err);
                    return done(err);
                }
                // Respond with a message if no such user exists
                if (!user) {
                    return done(null, false, { message: 'No such user exists.' });
                }
                // Otherwise check the password
                user.comparePassword(password, function(err, isMatch) {
                    if (err) {
                        console.log(err);
                        return done(err);
                    }
                    if (!isMatch) {
                        return done(null, false, { message: 'Looks like that was an incorrect password.' });
                    }
                    return done(null, user);
                });
            });
        }));

        passport.serializeUser(function(user, done) {
            done(null, user.id);
        });

        passport.deserializeUser(function(id, done) {
            models.User.findById(id, function(err, user) {
                done(null, user);
            });
        });
    };

    /**
     * Setup app configuration
     */
    self._setupApp = function() {
        self.app = express();
        self.app.configure(function() {
            self.app.set('views', path.join(self.config.repo, 'views'));
            self.app.set('view engine', 'jade');

            self.app.use(express.favicon(path.join(self.config.repo, 'public/img/favicon.ico')));
            self.app.use(express.bodyParser());
            self.app.use(express.methodOverride());

            self.app.use(express.cookieParser());
            self.app.use(express.session({ secret: 'temporarysecret', }));
            self.app.use(flash());

            self.app.use(passport.initialize());
            self.app.use(passport.session());

            // Template default available attributes
            self.app.use(function(req, res, next) {
                res.locals({
                    user: req.user,
                    path: req.path,
                    openshift: self.config.openshift
                });
                next();
            });

            self.app.use(self.app.router);
            self.app.use(express.static(path.join(self.config.repo, 'public')));
        });

        self.app.configure('development', function() {
            self.app.locals.pretty = true;
        });
    };

    /**
     * Setup routing table
     */
    self._setupRoutes = function() {
        var authMiddleware = ensureAuthenticated('/');
        var adminMiddleware = ensureAuthenticated('/', true);

        self.app.get('/', routes.index);
        self.app.post('/signup', routes.signup);
        self.app.post('/login', passport.authenticate('local', {
            successRedirect: '/lobby',
            failureRedirect: '/',
            failureFlash: true
        }));
        self.app.get('/logout', function(req, res) {
            req.logout();
            res.redirect('/');
        });

        self.app.get('/lobby', authMiddleware, routes.lobby);
        self.app.get('/game', authMiddleware, routes.game);
        self.app.get('/admin', adminMiddleware, routes.admin);
        self.app.post('/admin/add-lang', adminMiddleware, routes.addLang);
        self.app.post('/admin/reinit-exercises', adminMiddleware, routes.reinitExercises);
        self.app.get('/help', routes.help);
    };

    /**
     * Setup the realtime sockets
     */
    self._setupSockets = function() {
        var lobby = self.io.of('/lobby')
        .on('connection', function(socket) {
            socket.on('games:fetch', function(data) {
                models.Game.find({ isComplete: false }, function(err, docs) {
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
                        if (game.isJoinable) {
                            user.joinGame(game, function(err, game) {
                                if (err) {
                                    console.log(err);
                                    console.log('games:join error'); return;
                                }
                                socket.emit('games:join:res', { success: true, game: game });
                                socket.broadcast.emit('games:update', game);
                            });
                        } else {
                            socket.emit('games:join:res', { success: false });
                        }
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
                            }, function(err, game) {
                                if (err) {
                                    console.log(err);
                                    console.log('games:createnew error'); return;
                                }
                                socket.emit('games:createnew:res', { success: true, game: game });
                                socket.broadcast.emit('games:new', game);
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

            socket.on('ingame:ping', function(data) {
                models.Game.findById(data.gameId, function(err, game) {
                    if (err) {
                        console.log(err);
                        console.log('ingame:ping error'); return;
                    }
                    if (game) {
                        game.updateGameStatus(function(err, modified, game) {
                            if (err) {
                                console.log(err);
                                console.log('ingame:ping error'); return;
                            }
                            if (modified) {
                                lobby.emit('games:update', game);
                            }
                            socket.emit('ingame:ping:res', { game: game });
                        });
                    }
                });
            });

            socket.on('ingame:exit', function(data) {
                models.User.findById(data.player, function(err, user) {
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

                            if (game) {
                                if (game.isComplete) {
                                    lobby.emit('games:remove', { _id: game._id });
                                } else {
                                    lobby.emit('games:update', game);
                                }
                            }
                        });
                    }
                });
            });
        });
    };

    self._initialize();
};

if (require.main === module) {
    app = new SwiftCODE();
    app.listen();
}
