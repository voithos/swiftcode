'use strict';

var mongoose = require('mongoose');

module.exports.setupConnection = function(config) {
    // Connection string takes precedence
    if (config.dbconnectionstring) {
        mongoose.connect(config.dbconnectionstring);
    } else {
        mongoose.connect('mongodb://' + config.db.host + ':' + config.db.port + '/' + config.db.name, {
            user: config.db.username,
            pass: config.db.password
        });
    }
};
