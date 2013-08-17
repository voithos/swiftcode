#!/bin/env node

var express = require('express');
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
        self.app.listen(self.config.port, self.config.ipaddress, function() {
            console.log('Listening on ' + self.config.ipaddress + ':' + self.config.port);
        });
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

            self.app.use(function(req, res, next) {
                res.locals({
                    user: req.user
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
        self.app.get('/help', routes.help);
    };

    self._setupExercises = function() {
        self._exercises = {
            'javascript': {
                path: self.config.repo + 'exercises/javascript',
                projectName: 'Underscore.js'
            },
            'python': {
                path: self.config.repo + 'exercises/python',
                projectName: 'Bottle'
            }
        };

        _.forOwn(self._exercises, function(exercise) {
            exercise.parts = self._getExerciseParts(exercise.path);
        });
    };

    self._getExerciseParts = function(epath) {
        return _.map(fs.readdirSync(epath), function(file) {
            return fs.readFileSync(path.join(epath, file)).toString('utf-8');
        });
    };

    self._initialize();
};


if (require.main === module) {
    var app = module.exports = new SwiftCODE();
    app.listen();
}
