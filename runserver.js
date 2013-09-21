#!/usr/bin/env node
var forever = require('forever-monitor');

// TODO: Use official forever repo as dependency once
// ignorePattern bug has been fixed
var server = new forever.Monitor('server.js', {
    options: process.argv.slice(2),
    watch: true,
    watchIgnorePatterns: ['public/**', 'views/**'],
    watchDirectory: '.'
});

server.on('watch:restart', function(info) {
    console.error('    restarting script because ' + info.file + ' changed');
});
server.on('restart', function() {
    console.error('    (time ' + server.times + ')');
});
server.on('exit:code', function(code) {
    if (code) {
        console.error('    script exited with code ' + code);
    }
});
server.on('exit', function() {
    console.log('server.js exiting');
});
server.start();
