'use strict';

var events = require('events');

var SwiftCODEEventNet = function() {
};

SwiftCODEEventNet.prototype = new events.EventEmitter();

var enet = new SwiftCODEEventNet();
module.exports = enet;
