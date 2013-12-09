#!/usr/bin/env node
'use strict';

var express = require('express');
var io = require('socket.io');
var http = require('http');
var helmet = require('helmet');

var path = require('path');
var util = require('util');
var _ = require('lodash');
var fs = require('fs');

var settings;
try {
    settings = require('./settings');
} catch (e) {
    settings = {};
}

var db = require('./db');
var routes = require('./routes');
var models = require('./models');
var sockets = require('./sockets');

var SwiftCODEConfig = require('./config');

var mongoose = require('mongoose');

var SessionStore = require('session-mongoose')(express);

// Auth libs
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var flash = require('connect-flash');

var requireHTTPS = function(req, res, next) {
    if (req.headers['x-forwarded-proto'] != 'https') {
        return res.redirect(301, 'https://' + req.get('host') + req.url);
    }
    next();
};

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

var SwiftCODE = function() {
    var self = this;

    /**
     * Listen on the configured port and IP
     */
    self.listen = function() {
        self.server = http.createServer(self.app);

        // Socket.IO server needs to listen in the same block as the HTTP
        // server, or you'll get listen EACCES errors (due to Node's context
        // switching?)
        self.io = io.listen(self.server);
        self.server.listen(self.config.port, self.config.ipaddress);
        self.sockets.listen(self.io);

        util.log('Listening at ' + self.config.ipaddress + ':' + self.config.port);
    };

    self._initialize = function() {
        self._setupConfig();
        self._setupDb();
        self._setupSession();
        self._setupAuth();
        self._setupApp();
        self._setupRoutes();
        self._setupSockets();
    };

    self._setupConfig = function() {
        self.config = new SwiftCODEConfig();
    };

    /**
     * Setup database connection
     */
    self._setupDb = function() {
        db.setupConnection(self.config);

        models.Game.resetIncomplete();
        models.User.resetCurrentGames();
        models.User.resetAnonymous();
        models.User.setupAnonymous();
    };

    self._setupSession = function() {
        self.sessionstore = new SessionStore({
            interval: 120000,
            connection: mongoose.connection
        });
    };

    /**
     * Setup authentication and user config
     */
    self._setupAuth = function() {
        passport.use(new LocalStrategy(function(username, password, done) {
            models.User.findOne({ username: username }, function(err, user) {
                if (err) {
                    util.log(err);
                    return done(err);
                }
                // Respond with a message if no such user exists
                if (!user) {
                    return done(null, false, { message: 'No such user exists.' });
                }
                // Otherwise check the password
                user.comparePassword(password, function(err, isMatch) {
                    if (err) {
                        util.log(err);
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

        // Environment-specific configuration
        self.app.configure('development', function() {
            self.app.locals.pretty = true;
        });

        self.app.configure('production', function() {
            // Force redirection to HTTPS
            self.app.use(requireHTTPS);
        });

        // General configuration
        self.app.configure(function() {
            self.app.set('views', path.join(self.config.repo, 'views'));
            self.app.set('view engine', 'jade');

            // Use HTTP Strict Transport Security, to require compliant
            // user agents to communicate by HTTPS only
            self.app.use(helmet.hsts());

            self.app.use(express.favicon(path.join(self.config.repo, 'public/img/favicon.ico')));
            self.app.use(express.json());

            // Do not use bodyParser, which includes express.multipart, which
            // has a problem with creating tmp files on every request
            self.app.use(express.urlencoded());
            self.app.use(express.methodOverride());

            self.app.use(express.cookieParser());
            self.app.use(express.session({
                store: self.sessionstore,
                secret: self.config.sessionSecret,
                cookie: {
                    maxAge: 900 * 1000 // 15 minutes or 900 seconds
                }
            }));
            self.app.use(flash());

            self.app.use(passport.initialize());
            self.app.use(passport.session());

            // The default Connect session does not function as a normal
            // rolling session (i.e. session timeout cookies are not updated
            // per request - only when session is modified)
            self.app.use(function(req, res, next) {
                if (req.method === 'HEAD' || req.method === 'OPTIONS') {
                    return next();
                }
                // Force express to generate a new session timestamp
                req.session._noop = new Date().getTime();
                req.session.touch();
                next();
            });

            // Template default available attributes
            self.app.use(function(req, res, next) {
                res.locals({
                    user: req.user,
                    path: req.path
                });
                next();
            });

            self.app.use(self.app.router);
            self.app.use(express.static(path.join(self.config.repo, 'public')));
        });
    };

    /**
     * Setup routing table
     */
    self._setupRoutes = function() {
        var authMiddleware = ensureAuthenticated('/');
        var adminMiddleware = ensureAuthenticated('/', true);

        // Use custom authentication handler in order to redirect back
        // to the referer
        self.app.post('/login', function(req, res, next) {
            passport.authenticate('local', function(err, user, info) {
                if (err) { return next(err); }
                if (!user) {
                    req.flash('error', info.message);
                    return res.redirect(req.get('referer'));
                }
                req.login(user, function(err) {
                    if (err) { return next(err); }
                    return res.redirect('/lobby');
                });
            })(req, res, next);
        });

        self.app.get('/logout', function(req, res) {
            var deletionId;

            if (req.user) {
                if (req.user.isAnonymous) {
                    deletionId = req.user._id;
                }
                req.user.quitCurrentGame();
            }

            req.logout();

            if (deletionId) {
                models.User.remove({ _id: deletionId }, function(err) {
                    if (err) {
                        util.log(err);
                    }
                });
            }
            res.redirect('/');
        });


        self.app.get('/', routes.index);
        self.app.get('/signup', routes.signup);
        self.app.get('/playnow', routes.playnow);
        self.app.post('/create-account', routes.createAccount);
        self.app.get('/lobby', authMiddleware, routes.lobby);
        self.app.get('/game', authMiddleware, routes.game);
        self.app.get('/admin', adminMiddleware, routes.admin);
        self.app.post('/admin/add-lang', adminMiddleware, routes.addLang);
        self.app.post('/admin/reinit-exercises', adminMiddleware, routes.reinitExercises);
        self.app.get('/about', routes.about);
    };

    /**
     * Setup the realtime sockets
     */
    self._setupSockets = function() {
        self.sockets = new sockets();
    };

    self._initialize();
};

if (require.main === module) {
    var app = new SwiftCODE();
    app.listen();
}
