#!/bin/env node

var express = require('express');
var routes = require('./routes');
var path = require('path');

var everyauth = require('everyauth');
var mongoose = require('mongoose');

var SwiftConfig = function() {
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
        self._setupApp();
        self._setupRoutes();
    };

    self._setupConfig = function() {
        self.config = new SwiftConfig();
    };

    /**
     * Setup app configuration
     */
    self._setupApp = function() {
        self.app = express();
        self.app.configure(function() {
            self.app.set('views', path.join(self.config.repo, 'views'));
            self.app.set('view engine', 'jade');
            self.app.set('view options', { pretty: true });
            self.app.use(express.favicon());
            self.app.use(express.bodyParser());
            self.app.use(express.methodOverride());
            self.app.use(self.app.router);
            self.app.use(express.static(path.join(self.config.repo, 'public')));
        });
    };

    /**
     * Setup routing table
     */
    self._setupRoutes = function() {
        self.app.get('/', routes.index);
        self.app.get('/lobby', routes.lobby);
        self.app.get('/help', routes.help);
    };

    self._initialize();
};


if (require.main === module) {
    var app = new SwiftCODE();
    app.listen();
}
