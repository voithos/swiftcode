(function() {
  'use strict';

  module.exports = function(grunt) {
    var jsFiles = ['Gruntfile.js', 'public/**/*.js', '!public/js/libs/**/*.js',
      '!public/js/plugins.js', 'src/**/*.js'];

    grunt.initConfig({
      pkg: grunt.file.readJSON('package.json'),
      jshint: {
        options: {
          newcap: false
        },
        all: jsFiles
      },
      watch: {
        test: {
          files: jsFiles,
          tasks: ['usetheforce_on', 'test', 'usetheforce_off']
        }
      }
    });

    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-watch');

    // Workaround to force continuation when encountering errors
    // during development cycle (for watch / livereload)
    grunt.registerTask('usetheforce_on', '// force the force option', function() {
      if (!grunt.option('force')) {
        grunt.config.set('usetheforce', true);
        grunt.option('force', true);
      }
    });
    grunt.registerTask('usetheforce_off', '// remove the force option', function() {
      if (grunt.config.get('usetheforce')) {
        grunt.option('force', false);
      }
    });

    grunt.registerTask('test', 'Lint source files',
                       ['jshint']);
    grunt.registerTask('watchtest', 'Watch for changes and lint and test source files',
                       ['usetheforce_on', 'test', 'watch:test', 'usetheforce_off']);

    grunt.registerTask('add-admin', 'Add an administrator user into the database', function() {
      var done = this.async();

      var prompt = require('prompt');
      prompt.start();

      prompt.get([{
        name: 'username',
        required: true
      }, {
        name: 'password',
        hidden: true,
        required: true,
        conform: function(value) {
          return true;
        }
      }], function(err, result) {
        // Setup DB connection
        var SwiftCODEConfig = require('./src/config');
        var db = require('./src/db');
        var models = require('./src/models');
        db.setupConnection(new SwiftCODEConfig());

        var user = new models.User({
          username: result.username,
          password: result.password,
          isAdmin: true
        });
        user.save(function(err, saved) {
          if (err) {
            console.log(err);
          }
          done();
        });
      });
    });

    grunt.registerTask('default', ['test']);

  };
})();
