#!/usr/bin/env node
var forever = require('forever-monitor');

var server = new (forever.Monitor)('server.js', {
    options: process.argv.slice(2),
    watch: true,
    watchIgnorePatterns: ['public', 'views'],
    watchDirectory: '.'
});

server.on('exit', function() {
    console.log('server.js exiting');
});
server.start();
