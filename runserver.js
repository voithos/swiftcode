#!/usr/bin/env node
var forever = require('forever-monitor');

var server = new (forever.Monitor)('server.js', {
    options: process.argv.slice(2)
});

server.on('exit', function() {
    console.log('server.js exiting');
});
server.start();
