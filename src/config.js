'use strict';

var settings;
try {
    settings = require('./settings');
} catch (e) {
    settings = {};
}

// Constants
var SALT_LENGTH = 14; // 112 bits / 8 bits per char == 14

var genSalt = function(n) {
    var chars = [],
        corpus = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789~!@#$%^&*()-_=+[{]}\\|;:,<.>/?',
        length = corpus.length;

    for (var i = 0; i < n; i++) {
        chars.push(corpus.charAt(Math.floor(Math.random() * length)));
    }

    return chars.join('');
};

/**
 * Configuration app for SwiftCODE
 */
var SwiftCODEConfig = function() {
    // Setup configuration from the environment
    var self = this;

    self.repo = process.env.SWIFTCODE_REPO_DIR || './';

    self.sessionSecret = process.env.SWIFTCODE_SESSION_SECRET ||
        settings.sessionSecret || genSalt(SALT_LENGTH);

    self.ipaddress = process.env.SWIFTCODE_NODEJS_IP ||
        settings.ipaddress || '0.0.0.0';
    self.port = process.env.SWIFTCODE_NODEJS_PORT ||
        settings.port || 8080;

    self.dbconnectionstring = process.env.SWIFTCODE_DB_CONNECTIONSTRING ||
        settings.dbconnectionstring || null;

    self.db = {
        name: process.env.SWIFTCODE_DB_NAME ||
            settings.dbname || 'swiftcode',
        host: process.env.SWIFTCODE_DB_HOST ||
            settings.dbhost || 'localhost',
        port: process.env.SWIFTCODE_DB_PORT ||
            settings.dbport || 27017,
        username: process.env.SWIFTCODE_DB_USERNAME ||
            settings.dbusername || 'admin',
        password: process.env.SWIFTCODE_DB_PASSWORD ||
            settings.dbpassword || 'password'
    };
};

module.exports = SwiftCODEConfig;
