#!/bin/env node

var express = require('express');
var io = require('socket.io');
var http = require('http');

var app;
module.exports.getApp = function() {
    return app;
};

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
var ensureAuthenticated = require('connect-ensure-login').ensureAuthenticated;
var flash = require('connect-flash');

/**
 * Configuration app for SwiftCODE
 */
var SwiftCODEConfig = function() {
    // Setup configuration from the environment
    var self = this;

    // Setup a flag indicating if we're in OpenShift or not
    self.openshift = !!process.env.OPENSHIFT_APP_DNS;
    self.repo = process.env.OPENSHIFT_REPO_DIR || '';

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

    /**
     * Return the collection of exercises and their data
     */
    self.getExercises = function() {
        return _.sortBy(self._exercises, 'order');
    };

    self._initialize = function() {
        self._setupConfig();
        self._setupDb();
        self._setupAuth();
        self._setupApp();
        self._setupRoutes();
        self._setupExercises();
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
                           function() {
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
                    return done(err);
                }
                // Respond with a message if no such user exists
                if (!user) {
                    return done(null, false, { message: 'No such user exists.' });
                }
                // Otherwise check the password
                user.comparePassword(password, function(err, isMatch) {
                    if (err) {
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

            self.app.use(express.favicon());
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
                        console.log('games:join error'); return;
                    }
                    models.Game.findById(data.game, function(err, game) {
                        if (err) {
                            console.log('games:join error'); return;
                        }
                        if (game.isJoinable) {
                            user.joinGame(game, function(err, game) {
                                if (err) {
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
                var exercises = self._exercises;
                if (data.key in exercises) {
                    var lang = exercises[data.key];

                    models.User.findById(data.player, function(err, user) {
                        user.createGame({
                            lang: lang.key,
                            langName: lang.name,
                            maxPlayers: 4,
                            partFile: lang.randomExercise().partFile
                        }, function(err, game) {
                            if (err) {
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

        var game = self.io.of('/game')
        .on('connection', function(socket) {
            socket.on('ingame:ready', function(data) {
                models.User.findById(data.player, function(err, user) {
                    if (err) {
                        console.log('ingame:ready error'); return;
                    }
                    if (user) {
                        models.Game.findById(user.currentGame, function(err, game) {
                            if (game) {
                                if (err) {
                                    console.log('ingame:ready error'); return;
                                }
                                // Join a room
                                socket.join('game-' + game.id);
                                socket.emit('ingame:ready:res', { game: game, gameCode: self._getGameCode(game) });
                            }
                        });
                    }
                });
            });

            socket.on('ingame:exit', function(data) {
                models.User.findById(data.player, function(err, user) {
                    if (err) {
                        console.log('ingame:exit error'); return;
                    }
                    user.quitCurrentGame(function(err, game) {
                        if (err) {
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
                });
            });
        });
    };

    self._setupExercises = function() {
        self._exercises = {
            'javascript': {
                order: 0,
                key: 'javascript',
                name: 'JavaScript',
                path: self.config.repo + 'exercises/javascript',
                projectName: 'Underscore.js'
            },
            'python': {
                order: 1,
                key: 'python',
                name: 'Python',
                path: self.config.repo + 'exercises/python',
                projectName: 'Bottle'
            },
            'c-sharp': {
                order: 4,
                key: 'c-sharp',
                name: 'C#',
                path: self.config.repo + 'exercises/c-sharp',
                projectName: 'Signalr'
            }
        };

        var randomExercise = function() {
            return this.parts[Math.floor(Math.random() * this.parts.length)];
        };

        _.forOwn(self._exercises, function(lang) {
            lang.randomExercise = randomExercise;
            lang.partsMap = self._getExerciseParts(lang.path);
            lang.parts = _.sortBy(_.values(lang.partsMap), 'partFile');
        });
    };

    self._getExerciseParts = function(epath) {
        if (!fs.existsSync(epath)) {
            return [];
        }

        return _.zipObject(_.map(fs.readdirSync(epath), function(file) {
            return [file, {
                partFile: file,
                code: fs.readFileSync(path.join(epath, file)).toString('utf-8')
            }];
        }));
    };

    self._getGameCode = function(game) {
        var exercises = self._exercises;
        if (game.lang in exercises) {
            var lang = exercises[game.lang];

            if (game.partFile in lang.partsMap) {
                return lang.partsMap[game.partFile].code;
            } else {
                console.log('No such part file: ' + game.partFile);
            }
        } else {
            console.log('No such game type: ' + game.lang);
        }
    };

    self._initialize();
};

if (require.main === module) {
    app = new SwiftCODE();
    app.listen();
}
